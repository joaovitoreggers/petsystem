import { IsString, Matches, MinLength } from 'class-validator';

// E.164: + seguido de 8 a 15 dígitos — formato exigido pela API do Twilio
// tanto para SMS quanto para WhatsApp.
const E164 = /^\+[1-9]\d{7,14}$/;

export class CreateEmergencyContactDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @Matches(E164, { message: 'Telefone deve estar no formato internacional, ex. +5545999999999' })
  phone!: string;
}
