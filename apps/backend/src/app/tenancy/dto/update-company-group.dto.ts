import { IsString, MinLength } from 'class-validator';

export class UpdateCompanyGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
