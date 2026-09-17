import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { IUserRepository } from './repositories/user-repository.interface';
import { UsersService } from './users.service';

const GROUP_ID = 'gggggggg-gggg-gggg-gggg-gggggggggggg';

function user(overrides: Partial<User>): User {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Test',
    email: 'test@petsystem.local',
    password: 'hash',
    role: 'funcionario',
    companyGroupId: GROUP_ID,
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<IUserRepository>;
  let branchesService: { findById: jest.Mock };
  let accessControl: { sincronizarCargo: jest.Mock };

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      touchLastAccess: jest.fn(),
      findAllScoped: jest.fn().mockResolvedValue([]),
    };
    branchesService = { findById: jest.fn() };
    // Cadastrar alguem e, alem de gravar a conta, dar a ela o cargo do papel
    // escolhido — sem isso a conta nasce sem permissao nenhuma.
    accessControl = { sincronizarCargo: jest.fn().mockResolvedValue(undefined) };
    service = new UsersService(
      repository,
      branchesService as never,
      accessControl as never,
    );
  });

  describe('create', () => {
    it('rejects a duplicate email', async () => {
      repository.findByEmail.mockResolvedValue(user({}));

      await expect(
        service.create({
          name: 'New',
          email: 'test@petsystem.local',
          password: 'senha123',
          role: 'funcionario',
          companyGroupId: GROUP_ID,
        }),
      ).rejects.toThrow(ConflictException);

      expect(repository.create).not.toHaveBeenCalled();
    });

    it('hashes the password before persisting', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue(user({}));

      await service.create({
        name: 'New',
        email: 'new@petsystem.local',
        password: 'senha123',
        role: 'funcionario',
        companyGroupId: GROUP_ID,
      });

      const passedData = repository.create.mock.calls[0][0];
      expect(passedData.passwordHash).toBeDefined();
      expect(passedData.passwordHash).not.toBe('senha123');
    });

    it('defaults to the creator company group when none is given', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue(user({}));

      await service.create(
        {
          name: 'New',
          email: 'new@petsystem.local',
          password: 'senha123',
          role: 'funcionario',
        },
        { companyGroupId: GROUP_ID },
      );

      const passedData = repository.create.mock.calls[0][0];
      expect(passedData.companyGroupId).toBe(GROUP_ID);
    });

    it('rejects a non-platform-admin user with no resolvable company group', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'New',
          email: 'new@petsystem.local',
          password: 'senha123',
          role: 'funcionario',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('forces platform-admin users to have no company group', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue(user({ role: 'platform-admin', companyGroupId: null }));

      await service.create({
        name: 'Root',
        email: 'root@petsystem.local',
        password: 'senha123',
        role: 'platform-admin',
        companyGroupId: GROUP_ID,
      });

      const passedData = repository.create.mock.calls[0][0];
      expect(passedData.companyGroupId).toBeNull();
      expect(passedData.branchId).toBeNull();
    });
  });

  describe('update', () => {
    it('rejects changing the email to one already used by another user', async () => {
      repository.findById.mockResolvedValue(user({}));
      repository.findByEmail.mockResolvedValue(
        user({ id: 'other-id', email: 'taken@petsystem.local' }),
      );

      await expect(
        service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
          email: 'taken@petsystem.local',
        }),
      ).rejects.toThrow(ConflictException);

      expect(repository.update).not.toHaveBeenCalled();
    });

    it('allows keeping your own email unchanged', async () => {
      const existing = user({});
      repository.findById.mockResolvedValue(existing);
      repository.findByEmail.mockResolvedValue(existing);
      repository.update.mockResolvedValue(existing);

      await expect(
        service.update(existing.id, { email: existing.email }),
      ).resolves.toEqual(existing);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('unknown-id', { name: 'Novo Nome' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('hashes the new password when one is provided', async () => {
      repository.findById.mockResolvedValue(user({}));
      repository.update.mockResolvedValue(user({}));

      await service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        password: 'novaSenha123',
      });

      const passedData = repository.update.mock.calls[0][1];
      expect(passedData.passwordHash).toBeDefined();
      expect(passedData.passwordHash).not.toBe('novaSenha123');
    });

    it('leaves the password untouched when none is provided', async () => {
      repository.findById.mockResolvedValue(user({}));
      repository.update.mockResolvedValue(user({}));

      await service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        name: 'Novo Nome',
      });

      const passedData = repository.update.mock.calls[0][1];
      expect(passedData.passwordHash).toBeUndefined();
    });

    it('clears the company group and branch when promoted to platform-admin', async () => {
      repository.findById.mockResolvedValue(user({}));
      repository.update.mockResolvedValue(user({ role: 'platform-admin', companyGroupId: null }));

      await service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        role: 'platform-admin',
      });

      const passedData = repository.update.mock.calls[0][1];
      expect(passedData.companyGroupId).toBeNull();
      expect(passedData.branchId).toBeNull();
    });
  });

  describe('delete', () => {
    it('throws NotFoundException when the user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.delete('unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('resolves when the user is deleted', async () => {
      repository.findById.mockResolvedValue(user({}));
      repository.delete.mockResolvedValue(true);

      await expect(service.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).resolves.toBeUndefined();
    });

    it('rejects deleting a user from a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(user({ companyGroupId: 'other-group' }));

      await expect(
        service.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
          role: 'gestor',
          companyGroupId: GROUP_ID,
          branchId: null,
        }),
      ).rejects.toThrow(NotFoundException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('lets platform-admin delete a user from any tenant', async () => {
      repository.findById.mockResolvedValue(user({ companyGroupId: 'other-group' }));
      repository.delete.mockResolvedValue(true);

      await expect(
        service.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
          role: 'platform-admin',
          companyGroupId: null,
          branchId: null,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('update — tenant isolation', () => {
    it('rejects editing a user that belongs to a different tenant, as if it did not exist', async () => {
      repository.findById.mockResolvedValue(user({ companyGroupId: 'other-group' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { name: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(NotFoundException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('rejects a non-platform-admin trying to move a user to a different company group', async () => {
      repository.findById.mockResolvedValue(user({}));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { companyGroupId: 'other-group' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(repository.update).not.toHaveBeenCalled();
    });

    it('a branch-restricted caller cannot edit a user from a sibling branch in the same group', async () => {
      repository.findById.mockResolvedValue(user({ companyGroupId: GROUP_ID, branchId: 'b2' }));

      await expect(
        service.update(
          'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
          { name: 'Hackeado' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: 'b1' },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll (recorte por industria)', () => {
    // O recorte deixou de acontecer aqui: quem filtra e o SQL, em
    // UserRepository.findAllScoped — recortar depois significaria carregar
    // antes o cadastro das outras empresas. O que este nivel garante e que o
    // escopo de quem pediu chega intacto ate la.
    it('entrega o escopo de quem pediu para a consulta', async () => {
      const escopo = { role: 'gestor', companyGroupId: GROUP_ID, branchId: null };
      repository.findAllScoped.mockResolvedValue([]);

      await service.findAll(escopo);

      expect(repository.findAllScoped).toHaveBeenCalledWith(escopo);
      // Se isto fosse chamado, a lista inteira da plataforma teria saido do
      // banco antes de qualquer filtro.
      expect(repository.findAll).not.toHaveBeenCalled();
    });

    it('nao inventa escopo quando nao ha sessao', async () => {
      repository.findAllScoped.mockResolvedValue([]);

      await service.findAll();

      expect(repository.findAllScoped).toHaveBeenCalledWith(undefined);
    });
  });

  describe('resolveTenancy (onde a conta e lotada)', () => {
    it('recusa lotar alguem numa industria de outro grupo', async () => {
      // O gestor da Lar mandando o id de uma industria da outra empresa: sem
      // esta checagem a conta nasceria la dentro.
      branchesService.findById.mockResolvedValue({
        id: 'ind-de-outra-empresa',
        companyGroupId: 'outro-grupo',
      });

      await expect(
        service.create(
          { name: 'X', email: 'x@y.z', password: 'p', role: 'porteiro', branchId: 'ind-de-outra-empresa' },
          { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
        ),
      ).rejects.toThrow('Indústria inválida para este grupo de empresas');
    });

    it('aceita industria do proprio grupo', async () => {
      branchesService.findById.mockResolvedValue({ id: 'ind-1', companyGroupId: GROUP_ID });
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockImplementation(async (d: unknown) => d as User);

      const criado = await service.create(
        { name: 'X', email: 'x@y.z', password: 'p', role: 'porteiro', branchId: 'ind-1' },
        { role: 'gestor', companyGroupId: GROUP_ID, branchId: null },
      );

      expect(criado.branchId).toBe('ind-1');
    });

    it('prende quem e lotado numa industria a propria industria', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockImplementation(async (d: unknown) => d as User);

      const criado = await service.create(
        { name: 'X', email: 'x@y.z', password: 'p', role: 'porteiro', branchId: 'outra-industria' },
        { role: 'admin', companyGroupId: GROUP_ID, branchId: 'minha-industria' },
      );

      // O campo enviado foi ignorado de proposito.
      expect(criado.branchId).toBe('minha-industria');
    });

    it('a conta de plataforma nao pertence a empresa nenhuma', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockImplementation(async (d: unknown) => d as User);

      const criado = await service.create({
        name: 'CEO',
        email: 'ceo@artech.local',
        password: 'p',
        role: 'platform-admin',
      });

      expect(criado.companyGroupId).toBeNull();
      expect(criado.branchId).toBeNull();
    });
  });
  describe('cargo da conta nova', () => {
    it('da a conta o cargo do papel escolhido', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue(user({ id: 'novo', role: 'gestor' }));

      await service.create({
        name: 'X',
        email: 'x@y.z',
        password: 'p',
        role: 'gestor',
        companyGroupId: GROUP_ID,
      });

      // Sem esta linha a conta entra sem permissao nenhuma: o papel fica
      // gravado em users.role, mas nada liga esse papel as permissoes.
      expect(accessControl.sincronizarCargo).toHaveBeenCalledWith('novo', 'gestor');
    });

    it('troca o cargo quando o papel muda', async () => {
      repository.findById.mockResolvedValue(user({ id: 'u1', role: 'gestor' }));
      repository.update.mockResolvedValue(user({ id: 'u1', role: 'porteiro' }));

      await service.update('u1', { role: 'porteiro' });

      expect(accessControl.sincronizarCargo).toHaveBeenCalledWith('u1', 'porteiro');
    });

    it('nao mexe no cargo quando o papel nao muda', async () => {
      repository.findById.mockResolvedValue(user({ id: 'u1', role: 'gestor' }));
      repository.update.mockResolvedValue(user({ id: 'u1', role: 'gestor' }));

      await service.update('u1', { name: 'Nome novo' });

      expect(accessControl.sincronizarCargo).not.toHaveBeenCalled();
    });
  });
});
