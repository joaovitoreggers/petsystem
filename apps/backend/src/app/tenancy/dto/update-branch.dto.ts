import { IsString, MinLength } from 'class-validator';

export class UpdateBranchDto {
  @IsString()
  @MinLength(1)
  name!: string;
}
