import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { SAFETY_ROLES } from '../safety-roles';

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

  /** Funcoes de seguranca — lista fechada, conferida no servidor. */
  @IsOptional()
  @IsArray()
  @IsIn(SAFETY_ROLES, { each: true })
  safetyRoles?: string[];
}
