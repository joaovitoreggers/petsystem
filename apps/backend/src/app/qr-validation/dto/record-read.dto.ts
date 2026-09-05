import { IsString, MinLength } from 'class-validator';

export class RecordReadDto {
  @IsString()
  @MinLength(1)
  qrCode!: string;
}
