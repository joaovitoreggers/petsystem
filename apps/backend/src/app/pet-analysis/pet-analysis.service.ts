import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { WorkPermit } from '../work-permits/entities/work-permit.entity';
import { WorkPermitsService } from '../work-permits/work-permits.service';
import { AREA_INFO, AreaStat, DailyStat, PetAnalysisResult, PetAnalysisSummary } from './pet-analysis.types';

const SYSTEM_PROMPT = `Você é um analista de segurança do trabalho (SESMT) revisando dados de
Permissões de Entrada e Trabalho (PETs) de uma indústria. Você recebe um resumo estatístico em
JSON com a contagem de PETs por área de risco (NR), taxas de ocorrência e volume diário de
emissões. Escreva um relatório em português, em texto simples (sem markdown, sem asterisco, sem
títulos com #), organizado EXATAMENTE nestas quatro seções, nesta ordem, cada uma com o título em
maiúsculas seguido de dois-pontos:

RESUMO:
(2 a 3 frases sobre o panorama geral dos dados recebidos)

PRINCIPAIS CAUSAS POR ÁREA:
(para cada área de risco com atividade relevante no resumo, uma linha explicando prováveis causas
ou motivos de abertura de PETs coerentes com o perfil da norma daquela área)

ANOMALIAS DETECTADAS:
(comente os itens em unusualDays e unusualAreas do resumo, explicando por que o volume ou a taxa
de ocorrência está fora do padrão e quais problemas isso pode indicar; se ambas as listas vierem
vazias, diga explicitamente que nenhuma anomalia foi detectada no período)

RECOMENDAÇÕES:
(3 a 5 recomendações práticas e específicas para o SESMT, baseadas nos dados recebidos)

Use apenas os números do JSON recebido — nunca invente estatísticas que não estejam nele.`;

@Injectable()
export class PetAnalysisService {
  private readonly client: OpenAI | null;
  private readonly model: string;

  constructor(
    private readonly workPermitsService: WorkPermitsService,
    configService: ConfigService,
  ) {
    const apiKey = configService.get<string>('OPENAI_API_KEY');
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
    this.model = configService.get<string>('OPENAI_MODEL', 'gpt-4o-mini');
  }

  async analyze(): Promise<PetAnalysisResult> {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY não configurada no back-end — defina a variável de ambiente para habilitar a análise por IA.',
      );
    }

    const permits = await this.workPermitsService.findAll();
    const summary = this.buildSummary(permits);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(summary) },
      ],
    });

    const reportText = completion.choices[0]?.message?.content?.trim() ?? '';
    if (!reportText) {
      throw new ServiceUnavailableException('A IA não retornou nenhum conteúdo — tente novamente.');
    }

    return { generatedAt: new Date().toISOString(), summary, reportText };
  }

  private buildSummary(permits: WorkPermit[]): PetAnalysisSummary {
    const byArea: AreaStat[] = AREA_INFO.map((info) => {
      const areaPermits = permits.filter((p) => p.areas.includes(info.id));
      const occurrences = areaPermits.filter((p) => p.status === 'ocorrencia').length;
      return {
        areaId: info.id,
        areaLabel: info.label,
        nr: info.nr,
        total: areaPermits.length,
        occurrences,
        occurrenceRate: areaPermits.length ? Number((occurrences / areaPermits.length).toFixed(2)) : 0,
      };
    });

    const byDateMap = new Map<string, number>();
    for (const permit of permits) {
      byDateMap.set(permit.date, (byDateMap.get(permit.date) ?? 0) + 1);
    }
    const byDate: DailyStat[] = [...byDateMap.entries()]
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const avgPerDay = byDate.length ? permits.length / byDate.length : 0;
    const unusualDays = byDate.filter((d) => avgPerDay > 0 && d.count > avgPerDay * 1.5);
    const unusualAreas = byArea.filter((a) => a.total > 0 && a.occurrenceRate > 0.25);

    return {
      totalCount: permits.length,
      openCount: permits.filter((p) => p.status !== 'fechada').length,
      closedCount: permits.filter((p) => p.status === 'fechada').length,
      totalOccurrences: permits.filter((p) => p.status === 'ocorrencia').length,
      avgPerDay: Number(avgPerDay.toFixed(2)),
      byArea,
      byDate,
      unusualDays,
      unusualAreas,
    };
  }
}
