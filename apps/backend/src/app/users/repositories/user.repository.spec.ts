import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRepository } from './user.repository';

/**
 * O isolamento entre indústrias vive nesta consulta.
 *
 * Testar aqui, e não no service, é o ponto: desde que o filtro virou SQL, é
 * a cláusula montada que decide se o cadastro da Lar aparece para a outra
 * empresa. Um teste no nível de cima passaria mesmo com a consulta trazendo
 * tudo.
 */
function criarRepositorio() {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const typeorm = { createQueryBuilder: jest.fn(() => qb) };
  const repository = new UserRepository(typeorm as unknown as Repository<User>);
  return { repository, qb };
}

/** Todas as condições da consulta, numa lista só. */
function condicoes(qb: { where: jest.Mock; andWhere: jest.Mock }): string[] {
  return [...qb.where.mock.calls, ...qb.andWhere.mock.calls].map(([sql]: [string]) => sql);
}

describe('UserRepository.findAllScoped', () => {
  it('nunca lista a conta de plataforma, seja quem for que pergunte', async () => {
    for (const escopo of [
      undefined,
      { role: 'platform-admin', companyGroupId: null, branchId: null },
      { role: 'gestor', companyGroupId: 'g1', branchId: null },
      { role: 'porteiro', companyGroupId: 'g1', branchId: 'f1' },
    ]) {
      const { repository, qb } = criarRepositorio();

      await repository.findAllScoped(escopo as never);

      // A conta do dono do sistema existe e entra normalmente; ela só não
      // pertence ao cadastro de nenhuma indústria.
      expect(qb.where).toHaveBeenCalledWith('u.role <> :plataforma', {
        plataforma: 'platform-admin',
      });
    }
  });

  it('prende a consulta a uma industria quando a sessao e de uma industria', async () => {
    const { repository, qb } = criarRepositorio();

    await repository.findAllScoped({ role: 'porteiro', companyGroupId: 'g1', branchId: 'f1' });

    expect(qb.andWhere).toHaveBeenCalledWith('u.branch_id = :branchId', { branchId: 'f1' });
    expect(condicoes(qb).some((c) => c.includes('company_group_id'))).toBe(false);
  });

  it('prende ao grupo quem cuida do grupo inteiro', async () => {
    const { repository, qb } = criarRepositorio();

    await repository.findAllScoped({ role: 'gestor', companyGroupId: 'g1', branchId: null });

    expect(qb.andWhere).toHaveBeenCalledWith('u.company_group_id = :groupId', { groupId: 'g1' });
    expect(condicoes(qb).some((c) => c.includes('branch_id'))).toBe(false);
  });

  it('a industria manda mais que o grupo: sessao com as duas filtra pela industria', async () => {
    const { repository, qb } = criarRepositorio();

    await repository.findAllScoped({ role: 'admin', companyGroupId: 'g1', branchId: 'f1' });

    // Filtrar pelas duas seria redundante; filtrar só pelo grupo mostraria o
    // cadastro das outras indústrias da mesma empresa.
    expect(condicoes(qb)).toEqual(
      expect.arrayContaining(['u.role <> :plataforma', 'u.branch_id = :branchId']),
    );
    expect(condicoes(qb).some((c) => c.includes('company_group_id'))).toBe(false);
  });

  it('nao recorta por empresa para a conta de plataforma', async () => {
    const { repository, qb } = criarRepositorio();

    await repository.findAllScoped({ role: 'platform-admin', companyGroupId: null, branchId: null });

    // Quem administra a plataforma enxerga o cadastro de todas as empresas —
    // menos a propria conta, barrada pela clausula de sempre.
    expect(condicoes(qb)).toEqual(['u.role <> :plataforma']);
  });

  it('sem sessao, so a regra da conta de plataforma se aplica', async () => {
    const { repository, qb } = criarRepositorio();

    await repository.findAllScoped(undefined);

    expect(condicoes(qb)).toEqual(['u.role <> :plataforma']);
  });
});
