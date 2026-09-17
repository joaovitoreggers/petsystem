import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { SAFETY_ROLES } from '../safety-roles';

export class UpdateTeamMemberDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  role?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  company?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  isThirdParty?: boolean;

  @IsOptional()
  @IsObject()
  documents?: Record<string, string>;

  @IsOptional()
  @IsArray()
  @IsIn(SAFETY_ROLES, { each: true })
  safetyRoles?: string[];
}
