import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { SIGNATURE_LIFECYCLE_EVENTS, SignatureLifecycleEvent } from '../entities/work-permit-signature.entity';

/**
 * `petRole` é sempre 'emitente' aqui de propósito: biometria depende de
 * WebAuthnCredential, que só existe pra `User` (login) — não pra um
 * `TeamMember` da escala, que não tem sessão própria. Ver a matriz de
 * métodos por tipo de signatário no plano da feature.
 */
export class RequestBiometricSignatureOptionsDto {
  @IsIn(['emitente'])
  petRole!: 'emitente';

  @IsIn(SIGNATURE_LIFECYCLE_EVENTS)
  lifecycleEvent!: SignatureLifecycleEvent;

  @IsOptional()
  @IsString()
  draftId?: string;

  @IsOptional()
  @IsString()
  workPermitId?: string;

  @IsObject()
  contentSnapshot!: Record<string, unknown>;
}
