import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  role?: string;

  @IsOptional()
  @IsBoolean()
  canAccessRiskAreas?: boolean;

  @IsOptional()
  @IsBoolean()
  canPerformCorrectiveService?: boolean;
}
