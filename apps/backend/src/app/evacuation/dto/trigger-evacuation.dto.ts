import { IsOptional, IsString } from 'class-validator';

export class TriggerEvacuationDto {
  @IsOptional()
  @IsString()
  workPermitId?: string;
}
