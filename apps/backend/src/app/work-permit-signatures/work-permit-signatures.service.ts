import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { AuthService } from '../auth/auth.service';
import { filterOwnedByScope, TenantScope } from '../auth/tenant-scope';
import { UsersService } from '../users/users.service';
import { computeContentHash } from './canonical-snapshot';
import {
  SignatureGeolocation,
  SignatureLifecycleEvent,
  SignaturePetRole,
  WorkPermitSignature,
} from './entities/work-permit-signature.entity';
import {
  IWorkPermitSignatureRepository,
  WORK_PERMIT_SIGNATURE_REPOSITORY,
} from './repositories/work-permit-signature-repository.interface';

interface PendingBiometricSignature {
  userId: string;
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  draftId: string | null;
  workPermitId: string | null;
  contentHash: string;
  contentSnapshot: Record<string, unknown>;
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

/**
 * Ledger de assinaturas eletrônicas de PET (abertura/encerramento) — hoje só
 * o método biometria está implementado (crachá+PIN e SMS/WhatsApp entram em
 * PRs seguintes, mesmo módulo/controller). Nenhum método aqui ainda é
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

  constructor(
    @Inject(WORK_PERMIT_SIGNATURE_REPOSITORY)
    private readonly repository: IWorkPermitSignatureRepository,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
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
