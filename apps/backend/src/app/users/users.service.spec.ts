import { ConflictException, NotFoundException } from '@nestjs/common';
import { User } from './entities/user.entity';
import { IUserRepository } from './repositories/user-repository.interface';
import { UsersService } from './users.service';

function user(overrides: Partial<User>): User {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    name: 'Test',
    email: 'test@petsystem.local',
    password: 'hash',
    role: 'funcionario',
    accessLevel: 3,
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
          accessLevel: 1,
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
        accessLevel: 1,
      });

      const passedData = repository.create.mock.calls[0][0];
      expect(passedData.passwordHash).toBeDefined();
      expect(passedData.passwordHash).not.toBe('senha123');
    });
  });

  describe('update', () => {
    it('rejects changing the email to one already used by another user', async () => {
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
      repository.findByEmail.mockResolvedValue(existing);
      repository.update.mockResolvedValue(existing);

      await expect(
        service.update(existing.id, { email: existing.email }),
      ).resolves.toEqual(existing);
    });

    it('throws NotFoundException when the user does not exist', async () => {
      repository.update.mockResolvedValue(null);

      await expect(
        service.update('unknown-id', { name: 'Novo Nome' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('hashes the new password when one is provided', async () => {
      repository.update.mockResolvedValue(user({}));

      await service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        password: 'novaSenha123',
      });

      const passedData = repository.update.mock.calls[0][1];
      expect(passedData.passwordHash).toBeDefined();
      expect(passedData.passwordHash).not.toBe('novaSenha123');
    });

    it('leaves the password untouched when none is provided', async () => {
      repository.update.mockResolvedValue(user({}));

      await service.update('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', {
        name: 'Novo Nome',
      });

      const passedData = repository.update.mock.calls[0][1];
      expect(passedData.passwordHash).toBeUndefined();
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
});
