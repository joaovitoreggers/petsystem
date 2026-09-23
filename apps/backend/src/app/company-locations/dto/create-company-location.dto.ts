import { ArrayNotEmpty, IsArray, IsString, MinLength } from 'class-validator';

export class CreateCompanyLocationDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  riskAreas!: string[];

  @IsString()
  @MinLength(1)
  unit!: string;
}
