import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { WorkPermitGasReadingDto } from './create-work-permit.dto';

export class AddReadingDto {
  @ValidateNested()
  @Type(() => WorkPermitGasReadingDto)
  gas!: WorkPermitGasReadingDto;
}
