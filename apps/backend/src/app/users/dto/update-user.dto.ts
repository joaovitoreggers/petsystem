import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { USER_ROLES } from './create-user.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsIn(USER_ROLES)
  role?: string;

  @IsOptional()
  @IsUUID()
  companyGroupId?: string;

  // Aceita `null` de propósito (além de omitido): omitido mantém a filial
  // atual, `null` explícito limpa a restrição (usuário passa a enxergar
  // todas as filiais do grupo) — ver UsersService.update().
  @IsOptional()
  @IsUUID()
  branchId?: string | null;
}
