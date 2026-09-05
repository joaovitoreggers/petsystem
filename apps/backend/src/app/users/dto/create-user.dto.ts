import { IsEmail, IsInt, IsString, Min, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @MinLength(1)
  role!: string;

  @IsInt()
  @Min(0)
  accessLevel!: number;
}
