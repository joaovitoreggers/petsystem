import { IsBoolean, IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

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
  @Matches(/^\+?[1-9]\d{7,14}$/)
  phone?: string;
}
