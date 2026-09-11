import { IsString, MinLength } from 'class-validator';

export class DeviceLoginDto {
  @IsString()
  @MinLength(1)
  deviceToken!: string;
}
