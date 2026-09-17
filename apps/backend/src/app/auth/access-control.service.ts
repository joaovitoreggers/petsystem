import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Responde a unica pergunta que autoriza uma acao: esta pessoa tem esta
 * permissao?
 *
 * A resposta vem do banco (user_roles -> role_permissions -> permissions) e
 * nao do token. A diferenca importa: permissao gravada no JWT continua
 * valendo ate o token expirar, o que significa que tirar o acesso de alguem
 * so teria efeito horas depois. Lendo do banco, revogar tem efeito na
 * proxima requisicao.
 *
 * Nao ha cache aqui de proposito. A consulta e um join sobre duas tabelas
 * indexadas por chave primaria, e guardar permissao em memoria por alguns
 * segundos e exatamente a janela em que um acesso revogado continua
 * funcionando. Se algum dia o custo aparecer numa medicao, o lugar de
 * resolver e aqui, com invalidacao explicita ao alterar cargo.
 */
@Injectable()
export class AccessControlService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * O cargo que corresponde ao papel guardado no cadastro.
   *
   * O sistema carrega dois conceitos de papel: a coluna `users.role`, que
   * existe desde o comeco, e a tabela `roles`, que veio com as permissoes. A
   * migration 002 casou os dois para quem ja existia; este mapa faz o mesmo
   * para quem for cadastrado daqui em diante — sem ele, conta nova nasce sem
   * permissao nenhuma e a pessoa entra num sistema onde nada aparece.
   */
  private static readonly CARGO_POR_PAPEL: Record<string, string> = {
    'platform-admin': 'administrador',
    admin: 'administrador',
    gestor: 'gestor',
    gestor_sesmt: 'gestor',
    porteiro: 'porteiro',
    operador: 'operador',
    operador_de_campo: 'operador',
    tecnico: 'operador',
    tecnico_seguranca: 'operador',
  };

  /**
   * Deixa o usuario com exatamente o cargo do papel dele.
   *
   * Roda no cadastro e na edicao. Troca em vez de acrescentar: quem deixa de
   * ser gestor e vira porteiro nao pode continuar com as permissoes de
   * gestor penduradas — seria uma promocao silenciosa ao contrario.
   *
   * Papel sem cargo correspondente fica sem nenhum: melhor uma conta que nao
   * pode nada, e reclama, do que uma que pode o que ninguem decidiu.
   */
  async sincronizarCargo(userId: string, papel: string): Promise<void> {
    const slug = AccessControlService.CARGO_POR_PAPEL[papel] ?? null;

    await this.dataSource.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    if (!slug) return;

    await this.dataSource.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, r.id FROM roles r WHERE r.slug = $2
       ON CONFLICT DO NOTHING`,
      [userId, slug],
    );
  }

  /** Todas as permissoes do usuario, vindas de todos os cargos dele. */
  async permissionsOf(userId: string): Promise<Set<string>> {
    const rows = await this.dataSource.query<{ slug: string }[]>(
      `SELECT DISTINCT p.slug
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions p       ON p.id = rp.permission_id
        WHERE ur.user_id = $1`,
      [userId],
    );
    return new Set(rows.map((r) => r.slug));
  }

  async has(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.permissionsOf(userId);
    return permissions.has(permission);
  }

  /**
   * Exige todas as permissoes da lista, e nao qualquer uma delas.
   *
   * Uma rota que pede duas permissoes esta dizendo que a acao toca duas
   * coisas distintas; liberar com metade seria liberar metade da acao.
   */
  async hasAll(userId: string, permissions: string[]): Promise<boolean> {
    if (permissions.length === 0) return true;
    const owned = await this.permissionsOf(userId);
    return permissions.every((p) => owned.has(p));
  }

  /** Cargos do usuario, para exibicao e para o front montar a navegacao. */
  async rolesOf(userId: string): Promise<{ slug: string; name: string }[]> {
    return this.dataSource.query<{ slug: string; name: string }[]>(
      `SELECT r.slug, r.name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY r.name`,
      [userId],
    );
  }
}
