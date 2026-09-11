import { IsString, MinLength } from 'class-validator';

export class CreateCompanyGroupDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
