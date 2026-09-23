import { IsOptional, IsString, Matches, MinLength } from 'class-validator';

const E164 = /^\+[1-9]\d{7,14}$/;

export class UpdateEmergencyContactDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(E164, { message: 'Telefone deve estar no formato internacional, ex. +5545999999999' })
  phone?: string;
}
