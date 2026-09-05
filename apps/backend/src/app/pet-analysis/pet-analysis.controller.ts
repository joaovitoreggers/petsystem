import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { PetAnalysisResult } from './pet-analysis.types';
import { PetAnalysisService } from './pet-analysis.service';

/**
 * Analisa as PETs registradas via OpenAI e gera um relatório apontando
 * possíveis causas e anomalias. Sem @UseGuards(JwtAuthGuard) de propósito —
 * mesmo motivo do WorkPermitsController: não há login real no front-end
 * deste MVP.
 */
@Controller('pet-analysis')
export class PetAnalysisController {
  constructor(private readonly petAnalysisService: PetAnalysisService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  analyze(): Promise<PetAnalysisResult> {
    return this.petAnalysisService.analyze();
  }
}
