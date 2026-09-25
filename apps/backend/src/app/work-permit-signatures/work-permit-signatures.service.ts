import { randomInt, randomUUID } from 'crypto';
import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../auth/auth.service';
import { assertOwnedByScope, filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
import { DeliveryStatus, NotificationChannel, NotificationsService } from '../notifications/notifications.service';
import { TeamMembersService } from '../team-members/team-members.service';
import { UsersService } from '../users/users.service';
import { computeContentHash } from './canonical-snapshot';
import {
  SignatureGeolocation,
  SignatureLifecycleEvent,
  SignaturePetRole,
  SignerType,
  WorkPermitSignature,
} from './entities/work-permit-signature.entity';
import {
  IWorkPermitSignatureRepository,
  WORK_PERMIT_SIGNATURE_REPOSITORY,
} from './repositories/work-permit-signature-repository.interface';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

const SIGNATURE_ROLE_LABEL: Record<SignaturePetRole, string> = {
  emitente: 'técnico emitente',
  executante: 'executante responsável',
  encerrante: 'quem está encerrando',
};

interface PendingBiometricSignature {
  userId: string;
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  draftId: string | null;
  workPermitId: string | null;
  contentHash: string;
  contentSnapshot: Record<string, unknown>;
}

interface PinLockoutState {
  failedAttempts: number;
  lockedUntil: number | null;
}

interface PendingOtpSignature {
  code: string;
  signerType: SignerType;
  signerUserId: string | null;
  signerTeamMemberRegistration: string | null;
  signerName: string;
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  draftId: string | null;
  workPermitId: string | null;
  contentHash: string;
  contentSnapshot: Record<string, unknown>;
  attempts: number;
  expiresAt: number;
}

export interface RequestBiometricOptionsInput {
  userId: string;
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  draftId?: string;
  workPermitId?: string;
  contentSnapshot: Record<string, unknown>;
}

export interface VerifyBiometricSignatureInput {
  userId: string;
  challengeId: string;
  response: AuthenticationResponseJSON;
  geolocation?: SignatureGeolocation | null;
  ip: string | null;
  userAgent: string | null;
  scope: TenantScope;
}

export interface VerifyCrachaPinSignatureInput {
  registration: string;
  pin: string;
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  draftId?: string;
  workPermitId?: string;
  contentSnapshot: Record<string, unknown>;
  geolocation?: SignatureGeolocation | null;
  scope: TenantScope;
}

export interface SendOtpSignatureInput {
  currentUserId: string;
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  registration?: string;
  channel: NotificationChannel;
  draftId?: string;
  workPermitId?: string;
  contentSnapshot: Record<string, unknown>;
  scope: TenantScope;
}

export interface VerifyOtpSignatureInput {
  otpId: string;
  code: string;
  geolocation?: SignatureGeolocation | null;
  ip: string | null;
  userAgent: string | null;
  scope: TenantScope;
}

/**
 * Ledger de assinaturas eletrônicas de PET (abertura/encerramento), com os
 * 3 métodos: biometria, crachá+PIN e código SMS/WhatsApp. Nenhum ainda é
 * chamado pelo assistente "Nova PET" — isso é o próximo PR; por enquanto os
 * endpoints existem e são testáveis diretamente.
 */
@Injectable()
export class WorkPermitSignaturesService {
  // Guarda o que está sendo assinado entre a chamada de /options e /verify —
  // chave é o mesmo challengeId devolvido pelo AuthService, que guarda só o
  // desafio WebAuthn em si (não o conteúdo). Uso único: removido no primeiro
  // /verify, sucedido ou não — reflete o mesmo comportamento de
  // AuthService.loginWithBiometric para o desafio em si.
  private readonly pendingBiometricSignatures = new Map<string, PendingBiometricSignature>();

  // Contador de tentativas de PIN por matrícula — mesmo raciocínio de um
  // cartão de débito: bloqueia temporariamente depois de errar demais, pra
  // limitar força bruta sobre um PIN curto (4-6 dígitos).
  private readonly pinLockouts = new Map<string, PinLockoutState>();

  // Códigos OTP pendentes, por otpId — TTL curto (5 min), uso único.
  private readonly pendingOtpSignatures = new Map<string, PendingOtpSignature>();

  constructor(
    @Inject(WORK_PERMIT_SIGNATURE_REPOSITORY)
    private readonly repository: IWorkPermitSignatureRepository,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly teamMembersService: TeamMembersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async requestBiometricSignatureOptions(
    input: RequestBiometricOptionsInput,
  ): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }> {
    const contentHash = computeContentHash(input.contentSnapshot);
    const { options, challengeId } = await this.authService.getSignatureAuthenticationOptions(
      input.userId,
      Buffer.from(contentHash, 'hex'),
    );
    this.pendingBiometricSignatures.set(challengeId, {
      userId: input.userId,
      petRole: input.petRole,
      lifecycleEvent: input.lifecycleEvent,
      draftId: input.draftId ?? null,
      workPermitId: input.workPermitId ?? null,
      contentHash,
      contentSnapshot: input.contentSnapshot,
    });
    return { options, challengeId };
  }

  async verifyBiometricSignature(input: VerifyBiometricSignatureInput): Promise<WorkPermitSignature> {
    const pending = this.pendingBiometricSignatures.get(input.challengeId);
    this.pendingBiometricSignatures.delete(input.challengeId);
    if (!pending || pending.userId !== input.userId) {
      throw new UnauthorizedException('Assinatura por biometria expirou — tente novamente');
    }

    // Lança se o desafio WebAuthn expirou, a assinatura criptográfica não
    // confere, ou a credencial não pertence a este usuário — é a fonte da
    // verdade sobre a validade da cerimônia em si.
    const { credentialId } = await this.authService.verifySignatureAssertion(
      input.userId,
      input.challengeId,
      input.response,
    );

    const user = await this.usersService.findById(input.userId);
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    return this.repository.create({
      workPermitId: pending.workPermitId,
      draftId: pending.draftId,
      petRole: pending.petRole,
      lifecycleEvent: pending.lifecycleEvent,
      signerType: 'user',
      signerUserId: user.id,
      signerTeamMemberRegistration: null,
      signerName: user.name,
      method: 'biometria',
      contentHash: pending.contentHash,
      contentSnapshot: pending.contentSnapshot,
      webauthnCredentialId: credentialId,
      ip: input.ip,
      userAgent: input.userAgent,
      geolocation: input.geolocation ?? null,
      companyGroupId: input.scope.companyGroupId,
      branchId: input.scope.branchId,
    });
  }

  /**
   * Crachá + PIN — crachá sozinho não vale como assinatura (só prova posse
   * do crachá físico, não que é a pessoa certa no momento); o PIN é o que
   * dá a segunda prova, igual um cartão de débito. Sempre um TeamMember
   * (nunca um User — quem tem crachá é a escala da PET, não uma conta de
   * login).
   */
  async verifyCrachaPinSignature(input: VerifyCrachaPinSignatureInput): Promise<WorkPermitSignature> {
    const member = await this.teamMembersService.findByRegistration(input.registration);
    if (!member) {
      throw new BadRequestException('Funcionário não encontrado para este crachá');
    }
    assertOwnedByScope(member, input.scope, 'Funcionário não encontrado para este crachá');

    if (!member.pinHash) {
      throw new BadRequestException(
        'Este funcionário ainda não tem PIN cadastrado — peça a um técnico ou gestor para cadastrar em Funcionários',
      );
    }

    this.assertPinNotLocked(input.registration);

    const pinMatches = await bcrypt.compare(input.pin, member.pinHash);
    if (!pinMatches) {
      this.registerFailedPinAttempt(input.registration);
      throw new UnauthorizedException('PIN incorreto');
    }
    this.pinLockouts.delete(input.registration);

    const contentHash = computeContentHash(input.contentSnapshot);
    return this.repository.create({
      workPermitId: input.workPermitId ?? null,
      draftId: input.draftId ?? null,
      petRole: input.petRole,
      lifecycleEvent: input.lifecycleEvent,
      signerType: 'team_member',
      signerUserId: null,
      signerTeamMemberRegistration: member.registration,
      signerName: member.name,
      method: 'cracha_pin',
      contentHash,
      contentSnapshot: input.contentSnapshot,
      geolocation: input.geolocation ?? null,
      companyGroupId: input.scope.companyGroupId,
      branchId: input.scope.branchId,
    });
  }

  private assertPinNotLocked(registration: string): void {
    const state = this.pinLockouts.get(registration);
    if (!state?.lockedUntil) {
      return;
    }
    if (state.lockedUntil > Date.now()) {
      throw new UnauthorizedException(
        'Muitas tentativas de PIN incorretas — tente de novo em alguns minutos',
      );
    }
    this.pinLockouts.delete(registration);
  }

  private registerFailedPinAttempt(registration: string): void {
    const state = this.pinLockouts.get(registration) ?? { failedAttempts: 0, lockedUntil: null };
    state.failedAttempts += 1;
    if (state.failedAttempts >= PIN_MAX_ATTEMPTS) {
      state.lockedUntil = Date.now() + PIN_LOCKOUT_MS;
    }
    this.pinLockouts.set(registration, state);
  }

  /**
   * Envia o código por SMS/WhatsApp — para o emitente (sempre quem está
   * logado, via User.phone) ou para um membro da escala identificado por
   * matrícula (via TeamMember.phone). `devCode` só vem preenchido quando o
   * Twilio não está configurado neste ambiente — é o que permite testar o
   * fluxo inteiro sem credencial real (ver NotificationsService).
   */
  async sendOtpSignatureCode(
    input: SendOtpSignatureInput,
  ): Promise<{ otpId: string; delivery: DeliveryStatus; devCode?: string }> {
    const signer = await this.resolveOtpSigner(input);

    if (!signer.phone) {
      throw new BadRequestException(
        signer.signerType === 'user'
          ? 'Cadastre um telefone para o seu usuário antes de assinar por SMS/WhatsApp'
          : 'Este funcionário ainda não tem telefone cadastrado — peça a um técnico ou gestor para cadastrar em Funcionários',
      );
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const contentHash = computeContentHash(input.contentSnapshot);
    const otpId = randomUUID();
    this.pendingOtpSignatures.set(otpId, {
      code,
      signerType: signer.signerType,
      signerUserId: signer.signerUserId,
      signerTeamMemberRegistration: signer.signerTeamMemberRegistration,
      signerName: signer.signerName,
      petRole: input.petRole,
      lifecycleEvent: input.lifecycleEvent,
      draftId: input.draftId ?? null,
      workPermitId: input.workPermitId ?? null,
      contentHash,
      contentSnapshot: input.contentSnapshot,
      attempts: 0,
      expiresAt: Date.now() + OTP_TTL_MS,
    });

    const delivery = await this.notificationsService.sendVerificationCode(signer.phone, code, input.channel);
    return {
      otpId,
      delivery,
      devCode: delivery === 'not_configured' ? code : undefined,
    };
  }

  private async resolveOtpSigner(input: SendOtpSignatureInput): Promise<{
    signerType: SignerType;
    signerUserId: string | null;
    signerTeamMemberRegistration: string | null;
    signerName: string;
    phone: string | null;
  }> {
    // 'emitente' e 'encerrante' são sempre quem está logado (mesma sessão
    // que abre/fecha a PET) — só 'executante' é um membro da escala sem
    // sessão própria, identificado por matrícula.
    if (input.petRole === 'emitente' || input.petRole === 'encerrante') {
      const user = await this.usersService.findById(input.currentUserId);
      if (!user) {
        throw new UnauthorizedException('Usuário não encontrado');
      }
      return {
        signerType: 'user',
        signerUserId: user.id,
        signerTeamMemberRegistration: null,
        signerName: user.name,
        phone: user.phone,
      };
    }

    if (!input.registration) {
      throw new BadRequestException('Informe a matrícula do funcionário que está assinando');
    }
    const member = await this.teamMembersService.findByRegistration(input.registration);
    if (!member) {
      throw new BadRequestException('Funcionário não encontrado para esta matrícula');
    }
    assertOwnedByScope(member, input.scope, 'Funcionário não encontrado para esta matrícula');
    return {
      signerType: 'team_member',
      signerUserId: null,
      signerTeamMemberRegistration: member.registration,
      signerName: member.name,
      phone: member.phone,
    };
  }

  async verifyOtpSignatureCode(input: VerifyOtpSignatureInput): Promise<WorkPermitSignature> {
    const pending = this.pendingOtpSignatures.get(input.otpId);
    if (!pending) {
      throw new UnauthorizedException('Código expirado — peça um novo código');
    }
    if (pending.expiresAt < Date.now()) {
      this.pendingOtpSignatures.delete(input.otpId);
      throw new UnauthorizedException('Código expirado — peça um novo código');
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      this.pendingOtpSignatures.delete(input.otpId);
      throw new UnauthorizedException('Muitas tentativas incorretas — peça um novo código');
    }
    if (pending.code !== input.code) {
      pending.attempts += 1;
      throw new UnauthorizedException('Código incorreto');
    }
    this.pendingOtpSignatures.delete(input.otpId);

    return this.repository.create({
      workPermitId: pending.workPermitId,
      draftId: pending.draftId,
      petRole: pending.petRole,
      lifecycleEvent: pending.lifecycleEvent,
      signerType: pending.signerType,
      signerUserId: pending.signerUserId,
      signerTeamMemberRegistration: pending.signerTeamMemberRegistration,
      signerName: pending.signerName,
      method: 'sms_otp',
      contentHash: pending.contentHash,
      contentSnapshot: pending.contentSnapshot,
      ip: input.ip,
      userAgent: input.userAgent,
      geolocation: input.geolocation ?? null,
      companyGroupId: input.scope.companyGroupId,
      branchId: input.scope.branchId,
    });
  }

  /**
   * Confere, no momento de criar a PET de fato, que cada papel exigido
   * (emitente/executante) tem uma assinatura para este draftId e que o
   * hash bate com o conteúdo recebido agora — se o conteúdo mudou desde a
   * assinatura (alguém voltou e editou algo), rejeita com 409 em vez de
   * deixar a PET nascer com um conteúdo diferente do que foi realmente
   * assinado. Usada por WorkPermitsService.create().
   */
  async requireDraftSignatures(
    draftId: string,
    contentSnapshot: Record<string, unknown>,
    requiredRoles: SignaturePetRole[],
    scope: TenantScope | undefined,
  ): Promise<WorkPermitSignature[]> {
    const signatures = filterOwnedByScope(await this.repository.findByDraftId(draftId), scope);
    const expectedHash = computeContentHash(contentSnapshot);

    for (const role of requiredRoles) {
      const signature = signatures.find((s) => s.petRole === role);
      if (!signature) {
        throw new BadRequestException(
          `Falta a assinatura de ${SIGNATURE_ROLE_LABEL[role]} para emitir esta PET`,
        );
      }
      if (signature.contentHash !== expectedHash) {
        throw new ConflictException(
          'O conteúdo da PET mudou depois de assinado — volte à etapa de assinatura e assine de novo',
        );
      }
    }
    return signatures;
  }

  async linkDraftToWorkPermit(draftId: string, workPermitId: string): Promise<void> {
    await this.repository.linkDraftToWorkPermit(draftId, workPermitId);
  }

  /**
   * Confere, no encerramento de fato, que cada assinatura referenciada
   * existe, é de encerramento, pertence a esta PET e a este tenant, e que o
   * hash bate com o conteúdo recebido agora — mesmo raciocínio de
   * requireDraftSignatures(), mas mais simples porque a PET já tem id real
   * (não precisa de draftId). Usada por WorkPermitsService.close().
   */
  async requireClosingSignatures(
    workPermitId: string,
    signatureIds: string[],
    contentSnapshot: Record<string, unknown>,
    scope: TenantScope | undefined,
  ): Promise<WorkPermitSignature[]> {
    if (signatureIds.length === 0) {
      throw new BadRequestException('É necessário assinar o encerramento para fechar esta PET');
    }
    const signatures = filterOwnedByScope(await this.repository.findByWorkPermitId(workPermitId), scope);
    const expectedHash = computeContentHash(contentSnapshot);

    const matched: WorkPermitSignature[] = [];
    for (const id of signatureIds) {
      const signature = signatures.find((s) => s.id === id && s.lifecycleEvent === 'encerramento');
      if (!signature) {
        throw new BadRequestException('Assinatura de encerramento não encontrada para esta PET');
      }
      if (signature.contentHash !== expectedHash) {
        throw new ConflictException(
          'O conteúdo do encerramento mudou depois de assinado — assine de novo',
        );
      }
      matched.push(signature);
    }
    return matched;
  }

  async findByDraftId(draftId: string, scope: TenantScope): Promise<WorkPermitSignature[]> {
    const signatures = await this.repository.findByDraftId(draftId);
    return filterOwnedByScope(signatures, scope);
  }

  findByWorkPermitId(workPermitId: string, scope: TenantScope): Promise<WorkPermitSignature[]> {
    return this.repository.findByWorkPermitId(workPermitId).then((signatures) =>
      filterOwnedByScope(signatures, scope),
    );
  }
}
