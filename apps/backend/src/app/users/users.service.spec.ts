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

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new UsersService(repository);
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
      repository.delete.mockResolvedValue(false);

      await expect(service.delete('unknown-id')).rejects.toThrow(NotFoundException);
    });

    it('resolves when the user is deleted', async () => {
      repository.delete.mockResolvedValue(true);

      await expect(service.delete('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).resolves.toBeUndefined();
    });
  });

  describe('findAll (tenant scoping)', () => {
    it('returns every user when there is no scope', async () => {
      const users = [user({ id: '1' }), user({ id: '2', companyGroupId: 'other-group' })];
      repository.findAll.mockResolvedValue(users);

      await expect(service.findAll()).resolves.toEqual(users);
    });

    it('returns every user for platform-admin, across every group', async () => {
      const users = [user({ id: '1' }), user({ id: '2', companyGroupId: 'other-group' })];
      repository.findAll.mockResolvedValue(users);

      await expect(
        service.findAll({ role: 'platform-admin', companyGroupId: null, branchId: null }),
      ).resolves.toEqual(users);
    });

    it('restricts a branch-scoped caller to users of that exact branch', async () => {
      const users = [
        user({ id: '1', branchId: 'b1' }),
        user({ id: '2', branchId: 'b2' }),
        user({ id: '3', branchId: null }),
      ];
      repository.findAll.mockResolvedValue(users);

      const result = await service.findAll({ role: 'admin', companyGroupId: GROUP_ID, branchId: 'b1' });

      expect(result.map((u: User) => u.id)).toEqual(['1']);
    });

    it('restricts a group-wide caller to users of their own company group, regardless of branch', async () => {
      const users = [
        user({ id: '1', companyGroupId: GROUP_ID, branchId: 'b1' }),
        user({ id: '2', companyGroupId: GROUP_ID, branchId: null }),
        user({ id: '3', companyGroupId: 'other-group', branchId: null }),
      ];
      repository.findAll.mockResolvedValue(users);

      const result = await service.findAll({ role: 'gestor', companyGroupId: GROUP_ID, branchId: null });

      expect(result.map((u: User) => u.id)).toEqual(['1', '2']);
    });
  });
});
