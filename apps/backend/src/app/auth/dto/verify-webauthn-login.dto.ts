import { IsObject, IsString, MinLength } from 'class-validator';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export class VerifyWebAuthnLoginDto {
  @IsString()
  @MinLength(1)
  challengeId!: string;

  // Sem @ValidateNested() de propósito: é o objeto que
  // @simplewebauthn/browser gera e @simplewebauthn/server valida a fundo
  // (assinatura, contador, origem) — redigitar essa validação aqui só
  // duplicaria a real, feita na verificação criptográfica.
  @IsObject()
  response!: AuthenticationResponseJSON;
}
