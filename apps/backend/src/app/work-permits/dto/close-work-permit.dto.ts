import { IsInt, IsString, Min } from 'class-validator';

export class CloseWorkPermitDto {
  @IsString()
  end!: string;

  @IsInt()
  @Min(0)
  durationMinutes!: number;
}
