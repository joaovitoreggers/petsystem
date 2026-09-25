import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { WorkPermitSignature } from './entities/work-permit-signature.entity';
import { IWorkPermitSignatureRepository } from './repositories/work-permit-signature-repository.interface';
import { WorkPermitSignaturesService } from './work-permit-signatures.service';

function fullUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    name: 'Bárbara M. Garlini',
    email: 'barbara@petsystem.local',
    password: 'hash',
    role: 'tecnico',
    phone: null,
    companyGroupId: 'g1',
    branchId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function signature(overrides: Partial<WorkPermitSignature> = {}): WorkPermitSignature {
  return {
    id: 'sig-1',
    workPermitId: null,
    draftId: 'draft-1',
    petRole: 'emitente',
    lifecycleEvent: 'abertura',
    signerType: 'user',
    signerUserId: 'u1',
    signerTeamMemberRegistration: null,
    signerName: 'Bárbara M. Garlini',
    method: 'biometria',
    contentHash: 'hash',
    contentSnapshot: {},
    webauthnCredentialId: 'cred-1',
    ip: null,
    userAgent: null,
    geolocation: null,
    companyGroupId: 'g1',
    branchId: null,
    signedAt: new Date(),
    ...overrides,
  };
}

describe('WorkPermitSignaturesService', () => {
  let service: WorkPermitSignaturesService;
  let repository: jest.Mocked<IWorkPermitSignatureRepository>;
  let authService: jest.Mocked<
    Pick<AuthService, 'getSignatureAuthenticationOptions' | 'verifySignatureAssertion'>
  >;
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      findByDraftId: jest.fn(),
      findByWorkPermitId: jest.fn(),
      linkDraftToWorkPermit: jest.fn(),
    };
    authService = {
      getSignatureAuthenticationOptions: jest.fn(),
      verifySignatureAssertion: jest.fn(),
    };
    usersService = { findById: jest.fn() };
    service = new WorkPermitSignaturesService(
      repository,
      authService as unknown as AuthService,
      usersService as unknown as UsersService,
    );
  });

  describe('requestBiometricSignatureOptions', () => {
    it('computes the content hash from the snapshot and passes it through as the WebAuthn challenge', async () => {
      authService.getSignatureAuthenticationOptions.mockResolvedValue({
        options: { challenge: 'c1' } as never,
        challengeId: 'challenge-1',
      });

      const result = await service.requestBiometricSignatureOptions({
        userId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        draftId: 'draft-1',
        contentSnapshot: { location: 'Silo 4' },
      });

      expect(result.challengeId).toBe('challenge-1');
      const [userId, challenge] = authService.getSignatureAuthenticationOptions.mock.calls[0];
      expect(userId).toBe('u1');
      expect(challenge).toBeInstanceOf(Uint8Array);
      // sha256 hex digest is always 32 bytes.
      expect((challenge as Uint8Array).length).toBe(32);
    });

    it('produces the same hash for the same content regardless of key order', async () => {
      authService.getSignatureAuthenticationOptions.mockResolvedValue({
        options: {} as never,
        challengeId: 'c1',
      });

      await service.requestBiometricSignatureOptions({
        userId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        contentSnapshot: { a: 1, b: 2 },
      });
      const firstChallenge = authService.getSignatureAuthenticationOptions.mock.calls[0][1];

      authService.getSignatureAuthenticationOptions.mockClear();
      authService.getSignatureAuthenticationOptions.mockResolvedValue({
        options: {} as never,
        challengeId: 'c2',
      });
      await service.requestBiometricSignatureOptions({
        userId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        contentSnapshot: { b: 2, a: 1 },
      });
      const secondChallenge = authService.getSignatureAuthenticationOptions.mock.calls[0][1];

      expect(Buffer.from(firstChallenge as Uint8Array)).toEqual(Buffer.from(secondChallenge as Uint8Array));
    });
  });

  describe('verifyBiometricSignature', () => {
    it('rejects an unknown challengeId', async () => {
      await expect(
        service.verifyBiometricSignature({
          userId: 'u1',
          challengeId: 'missing',
          response: { id: 'cred-1' } as never,
          ip: null,
          userAgent: null,
          scope: { role: 'tecnico', companyGroupId: 'g1', branchId: null },
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(authService.verifySignatureAssertion).not.toHaveBeenCalled();
    });

    it("rejects a challengeId that belongs to a different user's pending signature", async () => {
      authService.getSignatureAuthenticationOptions.mockResolvedValue({
        options: {} as never,
        challengeId: 'challenge-1',
      });
      await service.requestBiometricSignatureOptions({
        userId: 'other-user',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        contentSnapshot: {},
      });

      await expect(
        service.verifyBiometricSignature({
          userId: 'u1',
          challengeId: 'challenge-1',
          response: { id: 'cred-1' } as never,
          ip: null,
          userAgent: null,
          scope: { role: 'tecnico', companyGroupId: 'g1', branchId: null },
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('propagates rejection from AuthService (expired/invalid assertion) without creating a signature', async () => {
      authService.getSignatureAuthenticationOptions.mockResolvedValue({
        options: {} as never,
        challengeId: 'challenge-1',
      });
      await service.requestBiometricSignatureOptions({
        userId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        contentSnapshot: {},
      });
      authService.verifySignatureAssertion.mockRejectedValue(new UnauthorizedException('nope'));

      await expect(
        service.verifyBiometricSignature({
          userId: 'u1',
          challengeId: 'challenge-1',
          response: { id: 'cred-1' } as never,
          ip: null,
          userAgent: null,
          scope: { role: 'tecnico', companyGroupId: 'g1', branchId: null },
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates a signature row with the pending content and the resolved signer name on success', async () => {
      authService.getSignatureAuthenticationOptions.mockResolvedValue({
        options: {} as never,
        challengeId: 'challenge-1',
      });
      await service.requestBiometricSignatureOptions({
        userId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        draftId: 'draft-1',
        contentSnapshot: { location: 'Silo 4' },
      });
      authService.verifySignatureAssertion.mockResolvedValue({ credentialId: 'cred-1' });
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1', name: 'Bárbara M. Garlini' }));
      repository.create.mockResolvedValue(signature({}));

      const result = await service.verifyBiometricSignature({
        userId: 'u1',
        challengeId: 'challenge-1',
        response: { id: 'cred-1' } as never,
        geolocation: { lat: -25.25, lng: -53.99, accuracy: 10 },
        ip: '127.0.0.1',
        userAgent: 'jest',
        scope: { role: 'tecnico', companyGroupId: 'g1', branchId: null },
      });

      expect(result).toEqual(signature({}));
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          draftId: 'draft-1',
          workPermitId: null,
          petRole: 'emitente',
          lifecycleEvent: 'abertura',
          signerType: 'user',
          signerUserId: 'u1',
          signerTeamMemberRegistration: null,
          signerName: 'Bárbara M. Garlini',
          method: 'biometria',
          contentSnapshot: { location: 'Silo 4' },
          webauthnCredentialId: 'cred-1',
          ip: '127.0.0.1',
          userAgent: 'jest',
          geolocation: { lat: -25.25, lng: -53.99, accuracy: 10 },
          companyGroupId: 'g1',
          branchId: null,
        }),
      );
    });

    it('rejects when the signing user has disappeared between the two calls', async () => {
      authService.getSignatureAuthenticationOptions.mockResolvedValue({
        options: {} as never,
        challengeId: 'challenge-1',
      });
      await service.requestBiometricSignatureOptions({
        userId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        contentSnapshot: {},
      });
      authService.verifySignatureAssertion.mockResolvedValue({ credentialId: 'cred-1' });
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.verifyBiometricSignature({
          userId: 'u1',
          challengeId: 'challenge-1',
          response: { id: 'cred-1' } as never,
          ip: null,
          userAgent: null,
          scope: { role: 'tecnico', companyGroupId: 'g1', branchId: null },
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('cannot be verified twice — the pending content is consumed on first use', async () => {
      authService.getSignatureAuthenticationOptions.mockResolvedValue({
        options: {} as never,
        challengeId: 'challenge-1',
      });
      await service.requestBiometricSignatureOptions({
        userId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        contentSnapshot: {},
      });
      authService.verifySignatureAssertion.mockResolvedValue({ credentialId: 'cred-1' });
      usersService.findById.mockResolvedValue(fullUser({}));
      repository.create.mockResolvedValue(signature({}));

      await service.verifyBiometricSignature({
        userId: 'u1',
        challengeId: 'challenge-1',
        response: { id: 'cred-1' } as never,
        ip: null,
        userAgent: null,
        scope: { role: 'tecnico', companyGroupId: 'g1', branchId: null },
      });

      await expect(
        service.verifyBiometricSignature({
          userId: 'u1',
          challengeId: 'challenge-1',
          response: { id: 'cred-1' } as never,
          ip: null,
          userAgent: null,
          scope: { role: 'tecnico', companyGroupId: 'g1', branchId: null },
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('findByDraftId — tenant scoping', () => {
    it('restricts results to the caller company group', async () => {
      repository.findByDraftId.mockResolvedValue([
        signature({ id: 's1', companyGroupId: 'g1' }),
        signature({ id: 's2', companyGroupId: 'other-group' }),
      ]);

      const result = await service.findByDraftId('draft-1', {
        role: 'tecnico',
        companyGroupId: 'g1',
        branchId: null,
      });

      expect(result.map((s) => s.id)).toEqual(['s1']);
    });

    it('returns every signature for platform-admin, regardless of tenant', async () => {
      repository.findByDraftId.mockResolvedValue([
        signature({ id: 's1', companyGroupId: 'g1' }),
        signature({ id: 's2', companyGroupId: 'other-group' }),
      ]);

      const result = await service.findByDraftId('draft-1', {
        role: 'platform-admin',
        companyGroupId: null,
        branchId: null,
      });

      expect(result.map((s) => s.id)).toEqual(['s1', 's2']);
    });
  });
});
