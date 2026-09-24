import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TeamMembersService } from '../team-members/team-members.service';
import { TeamMember } from '../team-members/entities/team-member.entity';
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

function teamMember(overrides: Partial<TeamMember> = {}): TeamMember {
  return {
    registration: '04812',
    name: 'Jonas R. Kirchner',
    role: 'Mecânico industrial',
    company: 'Lar · Manutenção',
    unit: 'Matelândia',
    companyGroupId: 'g1',
    branchId: null,
    isThirdParty: false,
    documents: {},
    phone: null,
    pinHash: null,
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
    signedAt: new Date('2026-01-01T00:00:00.000Z'),
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
  let teamMembersService: jest.Mocked<Pick<TeamMembersService, 'findByRegistration'>>;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'sendVerificationCode'>>;

  const scope = { role: 'tecnico', companyGroupId: 'g1', branchId: null };

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
    teamMembersService = { findByRegistration: jest.fn() };
    notificationsService = { sendVerificationCode: jest.fn() };
    service = new WorkPermitSignaturesService(
      repository,
      authService as unknown as AuthService,
      usersService as unknown as UsersService,
      teamMembersService as unknown as TeamMembersService,
      notificationsService as unknown as NotificationsService,
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

  describe('verifyCrachaPinSignature', () => {
    it('rejects when the registration does not exist', async () => {
      teamMembersService.findByRegistration.mockResolvedValue(null);

      await expect(
        service.verifyCrachaPinSignature({
          registration: '04812',
          pin: '1234',
          petRole: 'executante',
          lifecycleEvent: 'abertura',
          contentSnapshot: {},
          scope,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when the member belongs to a different tenant, as if it did not exist', async () => {
      teamMembersService.findByRegistration.mockResolvedValue(
        teamMember({ companyGroupId: 'other-group' }),
      );

      await expect(
        service.verifyCrachaPinSignature({
          registration: '04812',
          pin: '1234',
          petRole: 'executante',
          lifecycleEvent: 'abertura',
          contentSnapshot: {},
          scope,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects when the member has no PIN set yet', async () => {
      teamMembersService.findByRegistration.mockResolvedValue(teamMember({ pinHash: null }));

      await expect(
        service.verifyCrachaPinSignature({
          registration: '04812',
          pin: '1234',
          petRole: 'executante',
          lifecycleEvent: 'abertura',
          contentSnapshot: {},
          scope,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an incorrect PIN without creating a signature', async () => {
      const pinHash = await bcrypt.hash('1234', 4);
      teamMembersService.findByRegistration.mockResolvedValue(teamMember({ pinHash }));

      await expect(
        service.verifyCrachaPinSignature({
          registration: '04812',
          pin: '9999',
          petRole: 'executante',
          lifecycleEvent: 'abertura',
          contentSnapshot: {},
          scope,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('locks out after too many wrong PINs, even before checking the next attempt', async () => {
      const pinHash = await bcrypt.hash('1234', 4);
      teamMembersService.findByRegistration.mockResolvedValue(teamMember({ pinHash }));

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.verifyCrachaPinSignature({
            registration: '04812',
            pin: '9999',
            petRole: 'executante',
            lifecycleEvent: 'abertura',
            contentSnapshot: {},
            scope,
          }),
        ).rejects.toThrow(UnauthorizedException);
      }

      // The 6th attempt, even with the *correct* PIN, is rejected by the lockout.
      await expect(
        service.verifyCrachaPinSignature({
          registration: '04812',
          pin: '1234',
          petRole: 'executante',
          lifecycleEvent: 'abertura',
          contentSnapshot: {},
          scope,
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates a team_member signature with method cracha_pin on a correct PIN', async () => {
      const pinHash = await bcrypt.hash('1234', 4);
      teamMembersService.findByRegistration.mockResolvedValue(
        teamMember({ registration: '04812', name: 'Jonas R. Kirchner', pinHash }),
      );
      repository.create.mockResolvedValue(signature({}));

      await service.verifyCrachaPinSignature({
        registration: '04812',
        pin: '1234',
        petRole: 'executante',
        lifecycleEvent: 'abertura',
        contentSnapshot: { location: 'Silo 4' },
        scope,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          signerType: 'team_member',
          signerUserId: null,
          signerTeamMemberRegistration: '04812',
          signerName: 'Jonas R. Kirchner',
          method: 'cracha_pin',
          companyGroupId: 'g1',
          branchId: null,
        }),
      );
    });
  });

  describe('sendOtpSignatureCode', () => {
    it('sends to the current user phone for petRole emitente', async () => {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1', phone: '+5545999990000' }));
      notificationsService.sendVerificationCode.mockResolvedValue('sent');

      const result = await service.sendOtpSignatureCode({
        currentUserId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        channel: 'sms',
        contentSnapshot: {},
        scope,
      });

      expect(result.delivery).toBe('sent');
      expect(result.devCode).toBeUndefined();
      expect(notificationsService.sendVerificationCode).toHaveBeenCalledWith(
        '+5545999990000',
        expect.stringMatching(/^\d{6}$/),
        'sms',
      );
    });

    it('rejects when the emitente has no phone on file', async () => {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1', phone: null }));

      await expect(
        service.sendOtpSignatureCode({
          currentUserId: 'u1',
          petRole: 'emitente',
          lifecycleEvent: 'abertura',
          channel: 'sms',
          contentSnapshot: {},
          scope,
        }),
      ).rejects.toThrow(BadRequestException);
      expect(notificationsService.sendVerificationCode).not.toHaveBeenCalled();
    });

    it('requires a registration for a non-emitente role', async () => {
      await expect(
        service.sendOtpSignatureCode({
          currentUserId: 'u1',
          petRole: 'executante',
          lifecycleEvent: 'abertura',
          channel: 'sms',
          contentSnapshot: {},
          scope,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('sends to the team member phone for a non-emitente role, tenant-scoped', async () => {
      teamMembersService.findByRegistration.mockResolvedValue(
        teamMember({ registration: '04812', phone: '+5545988880000' }),
      );
      notificationsService.sendVerificationCode.mockResolvedValue('sent');

      await service.sendOtpSignatureCode({
        currentUserId: 'u1',
        petRole: 'executante',
        lifecycleEvent: 'abertura',
        registration: '04812',
        channel: 'whatsapp',
        contentSnapshot: {},
        scope,
      });

      expect(notificationsService.sendVerificationCode).toHaveBeenCalledWith(
        '+5545988880000',
        expect.stringMatching(/^\d{6}$/),
        'whatsapp',
      );
    });

    it('rejects a team member from a different tenant, as if it did not exist', async () => {
      teamMembersService.findByRegistration.mockResolvedValue(
        teamMember({ registration: '04812', phone: '+5545988880000', companyGroupId: 'other-group' }),
      );

      await expect(
        service.sendOtpSignatureCode({
          currentUserId: 'u1',
          petRole: 'executante',
          lifecycleEvent: 'abertura',
          registration: '04812',
          channel: 'whatsapp',
          contentSnapshot: {},
          scope,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('surfaces devCode only when delivery is not_configured', async () => {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1', phone: '+5545999990000' }));
      notificationsService.sendVerificationCode.mockResolvedValue('not_configured');

      const result = await service.sendOtpSignatureCode({
        currentUserId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        channel: 'sms',
        contentSnapshot: {},
        scope,
      });

      expect(result.devCode).toMatch(/^\d{6}$/);
    });
  });

  describe('verifyOtpSignatureCode', () => {
    async function sendCode(): Promise<{ otpId: string; code: string }> {
      usersService.findById.mockResolvedValue(fullUser({ id: 'u1', phone: '+5545999990000' }));
      notificationsService.sendVerificationCode.mockResolvedValue('not_configured');
      const { otpId, devCode } = await service.sendOtpSignatureCode({
        currentUserId: 'u1',
        petRole: 'emitente',
        lifecycleEvent: 'abertura',
        channel: 'sms',
        contentSnapshot: { location: 'Silo 4' },
        scope,
      });
      return { otpId, code: devCode! };
    }

    it('rejects an unknown otpId', async () => {
      await expect(
        service.verifyOtpSignatureCode({ otpId: 'missing', code: '123456', ip: null, userAgent: null, scope }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an incorrect code without creating a signature', async () => {
      const { otpId } = await sendCode();

      await expect(
        service.verifyOtpSignatureCode({ otpId, code: '000000', ip: null, userAgent: null, scope }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('locks out after too many incorrect attempts, even the real code no longer works', async () => {
      const { otpId, code } = await sendCode();

      for (let i = 0; i < 5; i += 1) {
        await expect(
          service.verifyOtpSignatureCode({ otpId, code: '000000', ip: null, userAgent: null, scope }),
        ).rejects.toThrow(UnauthorizedException);
      }

      await expect(
        service.verifyOtpSignatureCode({ otpId, code, ip: null, userAgent: null, scope }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates a signature with method sms_otp on the correct code', async () => {
      const { otpId, code } = await sendCode();
      repository.create.mockResolvedValue(signature({ method: 'sms_otp' }));

      await service.verifyOtpSignatureCode({
        otpId,
        code,
        ip: '127.0.0.1',
        userAgent: 'jest',
        scope,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'sms_otp',
          signerType: 'user',
          signerUserId: 'u1',
          contentSnapshot: { location: 'Silo 4' },
          ip: '127.0.0.1',
          userAgent: 'jest',
        }),
      );
    });

    it('cannot be verified twice — the code is consumed on first successful use', async () => {
      const { otpId, code } = await sendCode();
      repository.create.mockResolvedValue(signature({ method: 'sms_otp' }));

      await service.verifyOtpSignatureCode({ otpId, code, ip: null, userAgent: null, scope });

      await expect(
        service.verifyOtpSignatureCode({ otpId, code, ip: null, userAgent: null, scope }),
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
