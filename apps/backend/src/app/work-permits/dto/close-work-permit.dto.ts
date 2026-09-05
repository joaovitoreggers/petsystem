import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CloseWorkPermitDto {
  @IsString()
  end!: string;

  @IsInt()
  @Min(0)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  closedBy?: string;
}
