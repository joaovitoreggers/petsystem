import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  role?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  accessLevel?: number;
}
