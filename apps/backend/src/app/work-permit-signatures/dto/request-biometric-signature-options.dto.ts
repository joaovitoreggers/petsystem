import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import { SIGNATURE_LIFECYCLE_EVENTS, SignatureLifecycleEvent } from '../entities/work-permit-signature.entity';

/**
 * `petRole` nunca é 'executante' aqui de propósito: biometria depende de
 * WebAuthnCredential, que só existe pra `User` (login) — não pra um
 * `TeamMember` da escala, que não tem sessão própria. 'emitente' e
 * 'encerrante' são sempre quem está logado (a mesma sessão que abre ou
 * fecha a PET), por isso os dois usam User/biometria; só o executante é um
 * membro da escala. Ver a matriz de métodos por tipo de signatário no
 * plano da feature.
 */
export class RequestBiometricSignatureOptionsDto {
  @IsIn(['emitente', 'encerrante'])
  petRole!: 'emitente' | 'encerrante';

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
