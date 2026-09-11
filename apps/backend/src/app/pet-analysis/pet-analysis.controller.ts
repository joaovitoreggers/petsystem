import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AuthenticatedUser } from '../auth/jwt-payload.interface';
import { scopeFromUser } from '../auth/tenant-scope';
import { PetAnalysisResult } from './pet-analysis.types';
import { PetAnalysisService } from './pet-analysis.service';

/**
 * Analisa as PETs registradas via OpenAI e gera um relatório apontando
 * possíveis causas e anomalias. Exige login de verdade — sem sessão não dá
 * pra saber de qual tenant analisar, e as PETs de reconhecimento facial
 * (sem token) já caem no fallback local do front-end de qualquer jeito.
 */
@Controller('pet-analysis')
@UseGuards(JwtAuthGuard)
export class PetAnalysisController {
  constructor(private readonly petAnalysisService: PetAnalysisService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  analyze(@CurrentUser() currentUser: AuthenticatedUser): Promise<PetAnalysisResult> {
    return this.petAnalysisService.analyze(scopeFromUser(currentUser));
  }
}
