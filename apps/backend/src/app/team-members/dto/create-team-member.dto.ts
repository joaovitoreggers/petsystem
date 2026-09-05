import { IsBoolean, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

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
}
