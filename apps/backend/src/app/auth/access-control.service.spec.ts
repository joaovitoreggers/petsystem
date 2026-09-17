import { DataSource } from 'typeorm';
import { AccessControlService } from './access-control.service';

/**
 * As permissoes vem do banco a cada chamada, e nao do token. Os testes
 * cobrem o formato da consulta e as respostas de borda — principalmente o
 * usuario sem cargo nenhum, que precisa terminar sem permissao alguma em
 * vez de escorregar para "libera".
 */
describe('AccessControlService', () => {
  let query: jest.Mock;
  let service: AccessControlService;

  beforeEach(() => {
    query = jest.fn();
    service = new AccessControlService({ query } as unknown as DataSource);
  });

  it('devolve as permissoes vindas dos cargos do usuario', async () => {
    query.mockResolvedValue([
      { slug: 'visualizar_portas' },
      { slug: 'visualizar_eventos' },
    ]);

    const permissoes = await service.permissionsOf('u1');

    expect([...permissoes].sort()).toEqual([
      'visualizar_eventos',
      'visualizar_portas',
    ]);
    expect(query.mock.calls[0][1]).toEqual(['u1']);
  });

  it('usuario sem cargo fica sem permissao nenhuma', async () => {
    query.mockResolvedValue([]);

    expect(await service.has('u1', 'visualizar_portas')).toBe(false);
    expect(await service.hasAll('u1', ['visualizar_portas'])).toBe(false);
  });

  it('hasAll exige todas, nao qualquer uma', async () => {
    query.mockResolvedValue([{ slug: 'criar_tarefa' }]);

    expect(await service.hasAll('u1', ['criar_tarefa'])).toBe(true);
    expect(await service.hasAll('u1', ['criar_tarefa', 'editar_tarefa'])).toBe(
      false,
    );
  });

  it('lista vazia de permissoes nao bloqueia', async () => {
    // Rota sem exigencia declarada: nao ha o que checar, e consultar o banco
    // seria trabalho a toa.
    expect(await service.hasAll('u1', [])).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });

  it('consulta pelo id do usuario, nao pelo papel escrito no token', async () => {
    // Se a consulta partisse do texto do token, quem editasse o proprio
    // token escolheria as proprias permissoes.
    query.mockResolvedValue([]);
    await service.permissionsOf('u-42');

    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('user_roles');
    expect(sql).toContain('role_permissions');
    expect(params).toEqual(['u-42']);
  });
});
