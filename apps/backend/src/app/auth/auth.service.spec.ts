import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { BranchesService } from '../tenancy/branches.service';
import { CompanyGroupsService } from '../tenancy/company-groups.service';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './jwt-payload.interface';
import { WebAuthnCredential } from './entities/webauthn-credential.entity';
import { IWebAuthnCredentialRepository } from './repositories/webauthn-credential-repository.interface';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

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
    phone: null,
    companyGroupId: 'g1',
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function credential(overrides: Partial<WebAuthnCredential>): WebAuthnCredential {
  return {
    id: 'cred-1',
    userId: 'u1',
    publicKey: Buffer.from('public-key'),
    counter: 0,
    deviceType: 'singleDevice',
    backedUp: false,
    transports: ['internal'],
    lastUsedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'validatePassword' | 'findById'>>;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get'>>;
  let companyGroupsService: jest.Mocked<Pick<CompanyGroupsService, 'findById'>>;
  let branchesService: jest.Mocked<Pick<BranchesService, 'findById'>>;
  let webAuthnCredentialRepository: jest.Mocked<IWebAuthnCredentialRepository>;

  beforeEach(() => {
    jest.clearAllMocks();
    usersService = { findByEmail: jest.fn(), validatePassword: jest.fn(), findById: jest.fn() };
    jwtService = { sign: jest.fn().mockReturnValue('signed-jwt') };
    configService = { get: jest.fn((_key: string, def?: unknown) => def) };
    companyGroupsService = { findById: jest.fn() };
    branchesService = { findById: jest.fn() };
    webAuthnCredentialRepository = {
      findById: jest.fn(),
      findByUserId: jest.fn(),
      create: jest.fn(),
      updateCounter: jest.fn(),
      delete: jest.fn(),
    };
    service = new AuthService(
      usersService as unknown as UsersService,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
      companyGroupsService as unknown as CompanyGroupsService,
      branchesService as unknown as BranchesService,
      webAuthnCredentialRepository,
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

    it('resolves the display name from the current user record, not the JWT payload', async () => {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1', name: 'Bárbara M. Garlini' }));

      const result = await service.login(user({ id: 'u1' }));

      expect(result.user.name).toBe('Bárbara M. Garlini');
      expect(jwtService.sign).toHaveBeenCalledWith(expect.not.objectContaining({ name: expect.anything() }));
    });

    it('falls back to an empty name if the user record has disappeared since the JWT was issued', async () => {
      usersService.findById.mockResolvedValue(null);

      const result = await service.login(user({ id: 'u1' }));

      expect(result.user.name).toBe('');
    });
  });

  describe('getRegistrationOptions', () => {
    it('rejects when the user no longer exists', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.getRegistrationOptions('u1')).rejects.toThrow(UnauthorizedException);
    });

    it('excludes credentials already registered by this user, so the same authenticator cannot register twice', async () => {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1' }));
      webAuthnCredentialRepository.findByUserId.mockResolvedValue([
        credential({ id: 'existing-1', transports: ['internal'] }),
      ]);
      (generateRegistrationOptions as jest.Mock).mockResolvedValue({
        challenge: 'the-challenge',
      });

      await service.getRegistrationOptions('u1');

      const call = (generateRegistrationOptions as jest.Mock).mock.calls[0][0];
      expect(call.excludeCredentials).toEqual([{ id: 'existing-1', transports: ['internal'] }]);
      expect(call.authenticatorSelection).toMatchObject({
        authenticatorAttachment: 'platform',
        residentKey: 'required',
        userVerification: 'required',
      });
    });
  });

  describe('verifyRegistration', () => {
    it('rejects when no registration was ever started for this user', async () => {
      await expect(
        service.verifyRegistration('u1', {} as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(verifyRegistrationResponse).not.toHaveBeenCalled();
    });

    it('rejects when the challenge already expired', async () => {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1' }));
      webAuthnCredentialRepository.findByUserId.mockResolvedValue([]);
      (generateRegistrationOptions as jest.Mock).mockResolvedValue({ challenge: 'c1' });
      await service.getRegistrationOptions('u1');
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 10 * 60 * 1000);

      await expect(service.verifyRegistration('u1', {} as never)).rejects.toThrow(
        UnauthorizedException,
      );

      jest.spyOn(Date, 'now').mockRestore();
    });

    it('stores the credential returned by a verified registration', async () => {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1' }));
      webAuthnCredentialRepository.findByUserId.mockResolvedValue([]);
      (generateRegistrationOptions as jest.Mock).mockResolvedValue({ challenge: 'the-challenge' });
      await service.getRegistrationOptions('u1');
      (verifyRegistrationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: {
            id: 'new-cred-id',
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 0,
            transports: ['internal'],
          },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      });

      await service.verifyRegistration('u1', { id: 'new-cred-id' } as never);

      expect(webAuthnCredentialRepository.create).toHaveBeenCalledWith({
        id: 'new-cred-id',
        userId: 'u1',
        publicKey: Buffer.from([1, 2, 3]),
        counter: 0,
        deviceType: 'singleDevice',
        backedUp: false,
        transports: ['internal'],
      });
    });

    it('rejects when the server verification fails', async () => {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1' }));
      webAuthnCredentialRepository.findByUserId.mockResolvedValue([]);
      (generateRegistrationOptions as jest.Mock).mockResolvedValue({ challenge: 'the-challenge' });
      await service.getRegistrationOptions('u1');
      (verifyRegistrationResponse as jest.Mock).mockResolvedValue({ verified: false });

      await expect(service.verifyRegistration('u1', {} as never)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(webAuthnCredentialRepository.create).not.toHaveBeenCalled();
    });
  });

  describe('loginWithBiometric', () => {
    it('rejects an unknown or expired challengeId', async () => {
      await expect(
        service.loginWithBiometric('missing-challenge', { id: 'cred-1' } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(webAuthnCredentialRepository.findById).not.toHaveBeenCalled();
    });

    it('rejects when the credential id in the response is not registered', async () => {
      (generateAuthenticationOptions as jest.Mock).mockResolvedValue({ challenge: 'c1' });
      const { challengeId } = await service.getAuthenticationOptions();
      webAuthnCredentialRepository.findById.mockResolvedValue(null);

      await expect(
        service.loginWithBiometric(challengeId, { id: 'unknown-cred' } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(verifyAuthenticationResponse).not.toHaveBeenCalled();
    });

    it('rejects when the signature does not verify', async () => {
      (generateAuthenticationOptions as jest.Mock).mockResolvedValue({ challenge: 'c1' });
      const { challengeId } = await service.getAuthenticationOptions();
      webAuthnCredentialRepository.findById.mockResolvedValue(credential({}));
      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({ verified: false });

      await expect(
        service.loginWithBiometric(challengeId, { id: 'cred-1' } as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(webAuthnCredentialRepository.updateCounter).not.toHaveBeenCalled();
    });

    it('issues a real session and advances the stored counter on a verified login', async () => {
      (generateAuthenticationOptions as jest.Mock).mockResolvedValue({ challenge: 'c1' });
      const { challengeId } = await service.getAuthenticationOptions();
      webAuthnCredentialRepository.findById.mockResolvedValue(credential({ userId: 'u1', counter: 4 }));
      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 5 },
      });
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1' }));

      const result = await service.loginWithBiometric(challengeId, { id: 'cred-1' } as never);

      expect(result.accessToken).toBe('signed-jwt');
      expect(webAuthnCredentialRepository.updateCounter).toHaveBeenCalledWith('cred-1', 5);
    });

    it('rejects when the credential is valid but the user no longer exists', async () => {
      (generateAuthenticationOptions as jest.Mock).mockResolvedValue({ challenge: 'c1' });
      const { challengeId } = await service.getAuthenticationOptions();
      webAuthnCredentialRepository.findById.mockResolvedValue(credential({ userId: 'u1' }));
      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.loginWithBiometric(challengeId, { id: 'cred-1' } as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('cannot be replayed — the challenge is consumed on first use', async () => {
      (generateAuthenticationOptions as jest.Mock).mockResolvedValue({ challenge: 'c1' });
      const { challengeId } = await service.getAuthenticationOptions();
      webAuthnCredentialRepository.findById.mockResolvedValue(credential({ userId: 'u1' }));
      (verifyAuthenticationResponse as jest.Mock).mockResolvedValue({
        verified: true,
        authenticationInfo: { newCounter: 1 },
      });
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1' }));

      await service.loginWithBiometric(challengeId, { id: 'cred-1' } as never);

      await expect(
        service.loginWithBiometric(challengeId, { id: 'cred-1' } as never),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('hasBiometricCredential', () => {
    it('is true once at least one credential is registered', async () => {
      webAuthnCredentialRepository.findByUserId.mockResolvedValue([credential({})]);

      await expect(service.hasBiometricCredential('u1')).resolves.toBe(true);
    });

    it('is false with no credentials', async () => {
      webAuthnCredentialRepository.findByUserId.mockResolvedValue([]);

      await expect(service.hasBiometricCredential('u1')).resolves.toBe(false);
    });
  });

  describe('forgetBiometricCredential', () => {
    it('deletes the credential when it belongs to the caller', async () => {
      webAuthnCredentialRepository.findById.mockResolvedValue(credential({ userId: 'u1' }));

      await service.forgetBiometricCredential('cred-1', 'u1');

      expect(webAuthnCredentialRepository.delete).toHaveBeenCalledWith('cred-1');
    });

    it('does nothing when the credential belongs to a different user', async () => {
      webAuthnCredentialRepository.findById.mockResolvedValue(credential({ userId: 'someone-else' }));

      await service.forgetBiometricCredential('cred-1', 'u1');

      expect(webAuthnCredentialRepository.delete).not.toHaveBeenCalled();
    });

    it('does nothing when the credential does not exist', async () => {
      webAuthnCredentialRepository.findById.mockResolvedValue(null);

      await service.forgetBiometricCredential('cred-1', 'u1');

      expect(webAuthnCredentialRepository.delete).not.toHaveBeenCalled();
    });
  });
});
