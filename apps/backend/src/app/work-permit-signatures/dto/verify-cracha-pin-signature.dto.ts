import { IsIn, IsObject, IsOptional, IsString, Matches, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  SIGNATURE_LIFECYCLE_EVENTS,
  SIGNATURE_PET_ROLES,
  SignatureLifecycleEvent,
  SignaturePetRole,
} from '../entities/work-permit-signature.entity';
import { SignatureGeolocationDto } from './verify-biometric-signature.dto';

export class VerifyCrachaPinSignatureDto {
  @IsString()
  @MinLength(1)
  registration!: string;

  @Matches(/^\d{4,6}$/)
  pin!: string;

  @IsIn(SIGNATURE_PET_ROLES)
  petRole!: SignaturePetRole;

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

  @IsOptional()
  @ValidateNested()
  @Type(() => SignatureGeolocationDto)
  geolocation?: SignatureGeolocationDto;
}
