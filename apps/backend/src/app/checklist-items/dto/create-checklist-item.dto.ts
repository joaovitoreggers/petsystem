import { IsIn, IsString, MinLength } from 'class-validator';

// Mesmos 7 ids de RiskAreaId no front-end (pet-mock-data.ts) — duplicado
// aqui de propósito: o back-end não importa código do front-end, e esta
// lista muda raramente o bastante pra não valer a pena um pacote
// compartilhado só por isto.
export const RISK_AREA_IDS = [
  'confinado',
  'altura',
  'eletrico',
  'maquinas',
  'descarga',
  'naval',
  'plataforma',
] as const;

export class CreateChecklistItemDto {
  @IsIn(RISK_AREA_IDS)
  riskAreaId!: string;

  @IsString()
  @MinLength(1)
  label!: string;
}
