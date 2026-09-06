import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { WorkPermitTeamRole } from '../entities/work-permit.entity';

export class WorkPermitGasReadingDto {
  @IsNumber()
  o2!: number;

  @IsNumber()
  co!: number;

  @IsNumber()
  h2s!: number;

  @IsNumber()
  lel!: number;
}

export class WorkPermitCriticalAlertDto {
  @IsString()
  @MinLength(1)
  employeeName!: string;

  @IsString()
  @MinLength(1)
  registration!: string;

  @IsString()
  @MinLength(1)
  documentName!: string;

  @IsString()
  @MinLength(1)
  message!: string;

  @IsString()
  timestamp!: string;
}

export class WorkPermitTeamMemberDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  registration!: string;

  @IsString()
  @MinLength(1)
  role!: string;

  @IsIn(['equipe', 'vigia', 'resgate'])
  petRole!: WorkPermitTeamRole;
}

export class CreateWorkPermitDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  areas!: string[];

  @IsString()
  @MinLength(1)
  location!: string;

  @IsString()
  @MinLength(1)
  unit!: string;

  @IsInt()
  @Min(0)
  teamSize!: number;

  @IsString()
  date!: string;

  @IsString()
  start!: string;

  @IsString()
  technician!: string;

  @IsOptional()
  @IsString()
  coordinates?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkPermitGasReadingDto)
  gas?: WorkPermitGasReadingDto;

  @IsOptional()
  @IsBoolean()
  alarm?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkPermitCriticalAlertDto)
  criticalAlerts?: WorkPermitCriticalAlertDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkPermitTeamMemberDto)
  team?: WorkPermitTeamMemberDto[];

  @IsOptional()
  @IsString()
  companyPhone?: string;
}
