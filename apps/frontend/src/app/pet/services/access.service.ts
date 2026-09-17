import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MeResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    companyGroupId: string | null;
    branchId: string | null;
  };
  permissions: string[];
  /** O servidor devolve o cargo com apelido e nome exibível. */
  roles: { slug: string; name: string }[];
}

/**
 * O que a pessoa logada pode fazer, segundo o servidor.
 *
 * As permissoes nao sao deduzidas do cargo aqui: sao pedidas a `/auth/me`,
 * que as le do banco. Repetir a tabela cargo→permissao no navegador criaria
 * duas verdades que envelhecem em ritmos diferentes — mudar a permissao de
 * um cargo no banco passaria a exigir novo deploy do front.
 *
 * Isto e so para a interface: esconder um botao nao protege nada. Quem
 * recusa de verdade e o PermissionsGuard no back-end, em cada rota.
 */
@Injectable({ providedIn: 'root' })
export class AccessService {
  private readonly http = inject(HttpClient);

  private readonly permissoes = signal<ReadonlySet<string>>(new Set());
  readonly cargos = signal<readonly { slug: string; name: string }[]>([]);
  readonly carregando = signal(false);
  /** Verdadeiro depois da primeira resposta de /auth/me. */
  readonly carregado = signal(false);

  /** Nome do cargo, como aparece na tela ("Porteiro", "Gestor"). */
  readonly cargoLabel = computed(() => this.cargos()[0]?.name ?? null);

  /** Cargo principal, para escolher o painel inicial. */
  readonly cargoPrincipal = computed<
    'administrador' | 'gestor' | 'operador' | 'porteiro' | null
  >(() => {
    const ordem = ['administrador', 'gestor', 'operador', 'porteiro'] as const;
    const meus = new Set(this.cargos().map((c) => c.slug));
    return ordem.find((c) => meus.has(c)) ?? null;
  });

  /** Permissao unica. */
  readonly pode = computed(() => {
    const set = this.permissoes();
    return (slug: string) => set.has(slug);
  });

  /** Qualquer uma das permissoes — o caso dos itens de menu. */
  podeAlguma(...slugs: string[]): boolean {
    const set = this.permissoes();
    return slugs.some((s) => set.has(s));
  }

  async carregar(): Promise<void> {
    this.carregando.set(true);
    try {
      const me = await firstValueFrom(
        this.http.get<MeResponse>(`${environment.apiUrl}/auth/me`),
      );
      this.permissoes.set(new Set(me.permissions));
      this.cargos.set(me.roles);
      this.carregado.set(true);
    } catch {
      // Sem resposta, ninguem pode nada. Falhar para o lado fechado e o
      // unico jeito seguro: assumir permissao por causa de um erro de rede
      // abriria telas que a API vai recusar de qualquer forma.
      this.permissoes.set(new Set());
      this.cargos.set([]);
      this.carregado.set(true);
    } finally {
      this.carregando.set(false);
    }
  }

  limpar(): void {
    this.permissoes.set(new Set());
    this.cargos.set([]);
    this.carregado.set(false);
  }
}
