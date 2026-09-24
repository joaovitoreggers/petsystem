import { Matches } from 'class-validator';

export class SetTeamMemberPinDto {
  @Matches(/^\d{4,6}$/, { message: 'O PIN deve ter de 4 a 6 dígitos numéricos' })
  pin!: string;
}
