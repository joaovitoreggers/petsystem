import { IsBoolean, IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateTeamMemberDto {
  @IsString()
  @MinLength(1)
  registration!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  role!: string;

  @IsString()
  @MinLength(1)
  company!: string;

  @IsString()
  @MinLength(1)
  unit!: string;

  @IsOptional()
  @IsBoolean()
  isThirdParty?: boolean;

  @IsObject()
  documents!: Record<string, string>;

  // Formato E.164 (+55...) — usado para envio de código SMS/WhatsApp na
  // assinatura eletrônica de PET.
  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string;
}
