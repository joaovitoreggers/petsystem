import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CloseWorkPermitDto {
  @IsString()
  end!: string;

  @IsInt()
  @Min(0)
  durationMinutes!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  // Assinatura(s) de encerramento já coletadas (ver
  // WorkPermitSignaturesService.requireClosingSignatures) — quando
  // presente, `closedBy` é sempre derivado do signerName da assinatura,
  // nunca do corpo. Sem signatureIds, cai no caminho legado (usa
  // `closedBy` do corpo diretamente, sem exigir assinatura) — só para
  // chamadas antigas fora da tela de encerramento nova.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  signatureIds?: string[];

  @IsOptional()
  @IsString()
  closedBy?: string;
}
