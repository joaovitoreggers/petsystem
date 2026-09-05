import { IsInt, Min } from 'class-validator';

export class StartDetectionDto {
  @IsInt()
  @Min(1)
  personCount!: number;
}
