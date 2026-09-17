import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { WorkPermitGasReadingDto } from './create-work-permit.dto';

export class AddReadingDto {
  /**
   * `@IsDefined()` junto do `@ValidateNested()`: sozinho, o ValidateNested
   * nao reclama de um campo ausente — ele valida o que existe. Sem esta
   * linha, um pedido sem `gas` passava pela validacao e so estourava la
   * dentro, virando 500 em vez do 400 que a falha e.
   */
  @IsDefined({ message: 'Informe a leitura de gases (gas).' })
  @ValidateNested()
  @Type(() => WorkPermitGasReadingDto)
  gas!: WorkPermitGasReadingDto;
}
