import { IsNumber, IsObject, IsOptional, IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export class SignatureGeolocationDto {
  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsNumber()
  accuracy!: number;
}

export class VerifyBiometricSignatureDto {
  @IsString()
  @MinLength(1)
  challengeId!: string;

  // Sem @ValidateNested() de propósito: é o objeto que
  // @simplewebauthn/browser gera e @simplewebauthn/server valida a fundo
  // (assinatura, contador, origem) — mesmo padrão de VerifyWebAuthnLoginDto.
  @IsObject()
  response!: AuthenticationResponseJSON;

  @IsOptional()
  @ValidateNested()
  @Type(() => SignatureGeolocationDto)
  geolocation?: SignatureGeolocationDto;
}
