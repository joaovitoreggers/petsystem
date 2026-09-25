import { IsEmail, IsIn, IsOptional, IsString, IsUUID, Matches, MinLength } from 'class-validator';

export const USER_ROLES = [
  'platform-admin',
  'admin',
  'gestor',
  'tecnico',
  'porteiro',
  'operador',
] as const;

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsIn(USER_ROLES)
  role!: string;

  // Formato E.164 (+55...) — usado para envio de código SMS/WhatsApp na
  // assinatura eletrônica de PET.
  @IsOptional()
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string;

  // Opcional: se ausente, admin/gestor cadastram dentro do próprio grupo
  // (o controller resolve isso a partir da sessão). Só precisa ser
  // informado explicitamente por um platform-admin, que não tem grupo.
  @IsOptional()
  @IsUUID()
  companyGroupId?: string;

  @IsOptional()
  @IsUUID()
  branchId?: string;
}
