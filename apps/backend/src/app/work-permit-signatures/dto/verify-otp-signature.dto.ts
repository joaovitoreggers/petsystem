import { IsString, MinLength, ValidateNested, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { SignatureGeolocationDto } from './verify-biometric-signature.dto';

export class VerifyOtpSignatureDto {
  @IsString()
  @MinLength(1)
  otpId!: string;

  @IsString()
  @MinLength(1)
  code!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => SignatureGeolocationDto)
  geolocation?: SignatureGeolocationDto;
}
