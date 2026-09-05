import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  role!: string;

  @IsOptional()
  @IsBoolean()
  canAccessRiskAreas?: boolean;

  @IsOptional()
  @IsBoolean()
  canPerformCorrectiveService?: boolean;
}
