import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';
import {
  SIGNATURE_LIFECYCLE_EVENTS,
  SIGNATURE_PET_ROLES,
  SignatureLifecycleEvent,
  SignaturePetRole,
} from '../entities/work-permit-signature.entity';

export class SendOtpSignatureDto {
  @IsIn(SIGNATURE_PET_ROLES)
  petRole!: SignaturePetRole;

  @IsIn(SIGNATURE_LIFECYCLE_EVENTS)
  lifecycleEvent!: SignatureLifecycleEvent;

  // Só faz sentido (e é exigido pelo service) quando petRole !== 'emitente'
  // — o emitente é sempre quem está logado, nunca precisa se identificar
  // por matrícula.
  @IsOptional()
  @IsString()
  registration?: string;

  @IsIn(['sms', 'whatsapp'])
  channel!: 'sms' | 'whatsapp';

  @IsOptional()
  @IsString()
  draftId?: string;

  @IsOptional()
  @IsString()
  workPermitId?: string;

  @IsObject()
  contentSnapshot!: Record<string, unknown>;
}
