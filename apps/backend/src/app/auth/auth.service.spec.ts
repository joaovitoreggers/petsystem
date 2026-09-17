import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { BranchesService } from '../tenancy/branches.service';
import { CompanyGroupsService } from '../tenancy/company-groups.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './jwt-payload.interface';
import { DeviceCredential } from './entities/device-credential.entity';
import { IDeviceCredentialRepository } from './repositories/device-credential-repository.interface';

function user(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 'u1',
    email: 'user@petsystem.local',
    role: 'gestor',
    companyGroupId: 'g1',
    branchId: null,
    ...overrides,
  };
}

function fullUser(overrides: Partial<User>): User {
  return {
    id: 'u1',
    name: 'Test',
    email: 'user@petsystem.local',
    password: 'hash',
    role: 'gestor',
    companyGroupId: 'g1',
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function credential(overrides: Partial<DeviceCredential>): DeviceCredential {
  return {
    id: 'cred-1',
    userId: 'u1',
    secretHash: 'hash',
    lastUsedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'validatePassword' | 'findById'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let companyGroupsService: jest.Mocked<Pick<CompanyGroupsService, 'findById'>>;
  let branchesService: jest.Mocked<Pick<BranchesService, 'findById'>>;
  let deviceCredentialRepository: jest.Mocked<IDeviceCredentialRepository>;

  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      validatePassword: jest.fn(),
      findById: jest.fn(),
      registrarAcesso: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };
    companyGroupsService = { findById: jest.fn() };
    branchesService = { findById: jest.fn() };
    deviceCredentialRepository = {
      findById: jest.fn(),
      create: jest.fn(),
      touchLastUsed: jest.fn(),
      delete: jest.fn(),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      companyGroupsService as unknown as CompanyGroupsService,
      branchesService as unknown as BranchesService,
      deviceCredentialRepository,
    );
  });

  describe('login', () => {
    it('resolves the company group name for a group-wide session (no branch)', async () => {
      companyGroupsService.findById.mockResolvedValue({
        id: 'g1',
        name: 'Lar Cooperativa Agroindustrial',
        createdAt: new Date(),
      });

      const result = await service.login(user({ companyGroupId: 'g1', branchId: null }));

      expect(result.user.companyGroupName).toBe('Lar Cooperativa Agroindustrial');
      expect(result.user.branchName).toBeNull();
      expect(branchesService.findById).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('signed-jwt');
    });

    it('resolves both the company group and branch name for a branch-restricted session', async () => {
      companyGroupsService.findById.mockResolvedValue({
        id: 'g1',
        name: 'Lar Cooperativa Agroindustrial',
        createdAt: new Date(),
      });
      branchesService.findById.mockResolvedValue({
        id: 'b1',
        companyGroupId: 'g1',
        name: 'Matelândia',
        createdAt: new Date(),
      });

      const result = await service.login(user({ companyGroupId: 'g1', branchId: 'b1' }));

      expect(result.user.companyGroupName).toBe('Lar Cooperativa Agroindustrial');
      expect(result.user.branchName).toBe('Matelândia');
    });

    it('resolves both names to null for platform-admin (no group of their own)', async () => {
      const result = await service.login(
        user({ role: 'platform-admin', companyGroupId: null, branchId: null }),
      );

      expect(result.user.companyGroupName).toBeNull();
      expect(result.user.branchName).toBeNull();
      expect(companyGroupsService.findById).not.toHaveBeenCalled();
    });

    it('signs a JWT payload carrying only ids, never the resolved names', async () => {
      companyGroupsService.findById.mockResolvedValue({
        id: 'g1',
        name: 'Lar Cooperativa Agroindustrial',
        createdAt: new Date(),
      });

      await service.login(user({ companyGroupId: 'g1', branchId: null }));

      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.not.objectContaining({ companyGroupName: expect.anything() }),
      );
    });
  });

  describe('issueDeviceToken', () => {
    it('stores a bcrypt hash of the secret, never the secret itself', async () => {
      deviceCredentialRepository.create.mockResolvedValue(credential({}));

      const token = await service.issueDeviceToken('u1');

      const [id, secret] = token.split('.');
      expect(id).toBeTruthy();
      expect(secret).toBeTruthy();
      const createCall = deviceCredentialRepository.create.mock.calls[0][0];
      expect(createCall.userId).toBe('u1');
      expect(createCall.secretHash).not.toBe(secret);
      await expect(bcrypt.compare(secret, createCall.secretHash)).resolves.toBe(true);
    });
  });

  describe('loginWithDeviceToken', () => {
    it('rejects a malformed token (missing the secret half)', async () => {
      await expect(service.loginWithDeviceToken('just-an-id')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(deviceCredentialRepository.findById).not.toHaveBeenCalled();
    });

    it('rejects when the credential id does not exist', async () => {
      deviceCredentialRepository.findById.mockResolvedValue(null);

      await expect(service.loginWithDeviceToken('missing-id.some-secret')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects when the secret does not match the stored hash', async () => {
      const secretHash = await bcrypt.hash('the-real-secret', 4);
      deviceCredentialRepository.findById.mockResolvedValue(credential({ secretHash }));

      await expect(service.loginWithDeviceToken('cred-1.wrong-secret')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('issues a fresh real session when the token is valid, and marks it used', async () => {
      const secretHash = await bcrypt.hash('the-real-secret', 4);
      deviceCredentialRepository.findById.mockResolvedValue(credential({ secretHash, userId: 'u1' }));
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1' }));

      const result = await service.loginWithDeviceToken('cred-1.the-real-secret');

      expect(result.accessToken).toBe('signed-jwt');
      expect(deviceCredentialRepository.touchLastUsed).toHaveBeenCalledWith('cred-1');
    });

    it('rejects when the credential is valid but the user no longer exists', async () => {
      const secretHash = await bcrypt.hash('the-real-secret', 4);
      deviceCredentialRepository.findById.mockResolvedValue(credential({ secretHash }));
      usersService.findById.mockResolvedValue(null);

      await expect(service.loginWithDeviceToken('cred-1.the-real-secret')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('revokeDeviceToken', () => {
    it('deletes the credential when it belongs to the caller', async () => {
      deviceCredentialRepository.findById.mockResolvedValue(credential({ userId: 'u1' }));

      await service.revokeDeviceToken('cred-1.secret', 'u1');

      expect(deviceCredentialRepository.delete).toHaveBeenCalledWith('cred-1');
    });

    it('does nothing when the credential belongs to a different user', async () => {
      deviceCredentialRepository.findById.mockResolvedValue(credential({ userId: 'someone-else' }));

      await service.revokeDeviceToken('cred-1.secret', 'u1');

      expect(deviceCredentialRepository.delete).not.toHaveBeenCalled();
    });

    it('does nothing when the credential does not exist', async () => {
      deviceCredentialRepository.findById.mockResolvedValue(null);

      await service.revokeDeviceToken('cred-1.secret', 'u1');

      expect(deviceCredentialRepository.delete).not.toHaveBeenCalled();
    });
  });
});
