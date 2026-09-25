import { Component, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PetStateService } from '../pet-state.service';
import {
  ChecklistAnswer,
  GAS_LIMITS,
  GasKey,
  INCIDENT_CAUSE,
  petStatusView,
  PET_TEAM_ROLE_LABEL,
  Pet,
  RISK_AREAS,
  RiskAreaId,
  THIRTY_DAY_READINGS,
  buildChecklistGroups,
  buildMonitorArchive,
  dateToBr,
  minutesToLabel,
  riskAreaNames,
  riskAreaNr,
  riskAreaNrs,
} from '../pet-mock-data';
import { PetAnalysisApiService } from '../services/pet-analysis-api.service';
import { WorkPermitsApiService } from '../services/work-permits-api.service';
import { WorkPermitSignature } from '../services/work-permit-signatures-api.service';
import { HttpErrorResponse } from '@angular/common/http';
import { IconComponent } from '../../shared/icon.component';
import { IndustrialArtComponent } from '../../shared/industrial-art.component';
import { PetPrintDocumentComponent } from '../pet-print-document.component';

type HistoryFilter = 'todas' | 'aberta' | 'fechada' | 'ocorrencia' | RiskAreaId;

const HISTORY_FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'aberta', label: 'Abertas' },
  { id: 'fechada', label: 'Encerradas' },
  { id: 'ocorrencia', label: 'Ocorrências' },
  ...RISK_AREAS.map((area) => ({ id: area.id, label: area.name })),
];

@Component({
  selector: 'app-pet-manager',
  standalone: true,
  imports: [IconComponent, IndustrialArtComponent, PetPrintDocumentComponent],
  templateUrl: './pet-manager.component.html',
  styleUrls: ['./pet-manager.component.scss', './pet-report.scss'],
})
export class PetManagerComponent {
  readonly gasKeys: GasKey[] = ['o2', 'co', 'h2s', 'lel'];
  readonly teamRoleLabel = PET_TEAM_ROLE_LABEL;
  readonly checklistAnswerLabel: Record<ChecklistAnswer, string> = {
    sim: 'SIM',
    nao: 'NÃO',
    na: 'NA',
  };
  readonly historyFilters = HISTORY_FILTERS;
  readonly thirtyDays = THIRTY_DAY_READINGS;

  readonly reportModalOpen = signal(false);
  readonly viewingReport = signal(false);
  readonly reportFrom = signal('2026-08-01');
  readonly reportTo = signal('2026-09-05');
  readonly historyFilter = signal<HistoryFilter>('todas');

  readonly aiModalOpen = signal(false);
  readonly aiLoading = signal(false);
  readonly aiReport = signal<string | null>(null);
  readonly aiError = signal<string | null>(null);
  readonly aiGeneratedAt = signal<string | null>(null);

  // Detalhe de uma PET, aberto por qualquer lista do painel (frentes em
  // execução, histórico, ocorrências) — só leitura: o painel de gestão
  // audita, não opera a PET (isso é do técnico em campo).
  readonly detailPetId = signal<string | null>(null);

  // Trilha de assinatura eletrônica da PET aberta no detalhe — usada só
  // pelo documento de impressão (ver PetPrintDocumentComponent). Mesmo
  // padrão de busca com fallback silencioso de
  // PetStateService.openPetDetail(): sem sessão real ou servidor fora do
  // ar, o documento mostra "nenhuma assinatura registrada" em vez de
  // travar a abertura do detalhe.
  readonly detailPetSignatures = signal<WorkPermitSignature[]>([]);

  openDetail(id: string): void {
    this.detailPetId.set(id);
    this.detailPetSignatures.set([]);
    firstValueFrom(this.workPermitsApi.findSignatures(id))
      .then((signatures) => this.detailPetSignatures.set(signatures))
      .catch(() => {
        // sem sessão real ou servidor fora do ar — documento de impressão
        // mostra "nenhuma assinatura registrada" nesse caso
      });
  }

  closeDetail(): void {
    this.detailPetId.set(null);
  }

  // Isola a impressão em <app-pet-print-document> (ver
  // pet-print-document.component.ts): o detalhe é um diálogo, e a regra
  // global de impressão esconde .dialog-backdrop por padrão — a classe no
  // body revela só o documento de impressão em vez da tela toda por trás
  // dele. Mesmo truque de printAiReport().
  printPet(): void {
    const cleanup = () => {
      document.body.classList.remove('pet-detail-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.classList.add('pet-detail-printing');
    window.print();
  }

  constructor(
    readonly state: PetStateService,
    private readonly petAnalysisApi: PetAnalysisApiService,
    private readonly workPermitsApi: WorkPermitsApiService,
  ) {}

  openAiModal(): void {
    this.aiModalOpen.set(true);
    this.runAiAnalysis();
  }

  closeAiModal(): void {
    this.aiModalOpen.set(false);
  }

  async runAiAnalysis(): Promise<void> {
    this.aiLoading.set(true);
    this.aiError.set(null);
    this.aiReport.set(null);
    this.aiGeneratedAt.set(null);
    try {
      const result = await firstValueFrom(this.petAnalysisApi.analyze());
      this.aiReport.set(result.reportText);
      this.aiGeneratedAt.set(
        new Date(result.generatedAt).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        }),
      );
    } catch (err) {
      this.aiError.set(aiErrorMessage(err));
    } finally {
      this.aiLoading.set(false);
    }
  }

  printAiReport(): void {
    const cleanup = () => {
      document.body.classList.remove('ai-report-printing');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    document.body.classList.add('ai-report-printing');
    window.print();
  }

  readonly activePets = computed(() =>
    this.state.pets().filter((p) => p.status !== 'fechada'),
  );

  readonly detailPet = computed<Pet | undefined>(() =>
    this.state.pets().find((p) => p.id === this.detailPetId()),
  );
  readonly detailCard = computed(() => {
    const pet = this.detailPet();
    if (!pet) return null;
    return {
      status: petStatusView(pet),
      areaLabel: riskAreaNames(pet.areas),
      nr: riskAreaNrs(pet.areas),
    };
  });

  // Checklist respondido na etapa "Checklist e foto" — só os itens com
  // resposta salva aparecem (PETs emitidas antes desse campo existir, ou
  // com o checklist pulado, não têm nada aqui). As chaves vêm no mesmo
  // formato que o assistente gera, ver buildChecklistGroups().
  readonly detailChecklistGroups = computed(() => {
    const pet = this.detailPet();
    if (!pet?.checklist) return [];
    const checklist = pet.checklist;
    return buildChecklistGroups(pet.areas)
      .map((group) => ({
        title: group.title,
        items: group.items
          .filter((item) => checklist[item.key] !== undefined)
          .map((item) => ({ ...item, answer: checklist[item.key] })),
      }))
      .filter((group) => group.items.length > 0);
  });

  // Rondas de vigia de fogo (trabalho a quente) — só as de fato
  // preenchidas, pelo mesmo motivo do checklist acima.
  readonly detailFireWatchRounds = computed(
    () => this.detailPet()?.fireWatchRounds?.filter((r) => r.hora && r.nome) ?? [],
  );

  readonly kpis = computed(() => {
    const pets = this.state.pets();
    const open = pets.filter((p) => p.status !== 'fechada').length;
    const occurrences30d = pets.filter((p) => p.status === 'ocorrencia').length;
    const closed = pets.filter(
      (p) => p.status === 'fechada' && p.durationMinutes,
    );
    const avgMinutes = closed.length
      ? Math.round(
          closed.reduce((sum, p) => sum + (p.durationMinutes ?? 0), 0) /
            closed.length,
        )
      : 0;
    const totalReadings = this.thirtyDays.reduce((sum, d) => sum + d.total, 0);
    const totalOut = this.thirtyDays.reduce((sum, d) => sum + d.outOfRange, 0);
    const compliance = totalReadings
      ? (((totalReadings - totalOut) / totalReadings) * 100).toFixed(1)
      : '100.0';
    const criticalAlerts = pets.reduce(
      (sum, p) => sum + (p.criticalAlerts?.length ?? 0),
      0,
    );
    // Ordem = prioridade de leitura no painel: o que está acontecendo agora
    // e o que está em risco vêm antes dos indicadores de tendência.
    return [
      {
        label: 'PETs ativas agora',
        value: String(open),
        note: 'em campo nas 5 unidades',
        color: 'var(--text-strong)',
        critical: false,
      },
      {
        label: 'Alertas críticos de documentação',
        value: String(criticalAlerts),
        note: 'liberações com ressalva por NR vencida',
        color: criticalAlerts > 0 ? 'var(--status-bad)' : 'var(--text-strong)',
        critical: criticalAlerts > 0,
      },
      {
        label: 'Ocorrências registradas',
        value: String(occurrences30d),
        note: 'nos últimos 30 dias',
        color: occurrences30d > 0 ? 'var(--status-bad)' : 'var(--text-strong)',
        critical: occurrences30d > 0,
      },
      {
        label: 'Conformidade atmosférica',
        value: `${compliance}%`,
        note: 'leituras dentro do limite',
        color: 'var(--text-strong)',
        critical: false,
      },
      {
        label: 'Duração média',
        value: minutesToLabel(avgMinutes),
        note: 'permissões encerradas',
        color: 'var(--text-strong)',
        critical: false,
      },
    ];
  });

  readonly monitoredPetsView = computed(() =>
    this.activePets().map((pet) => ({
      pet,
      status: petStatusView(pet),
      areaLabel: riskAreaNames(pet.areas),
      nr: riskAreaNrs(pet.areas),
    })),
  );

  readonly totalMedicoes = computed(() =>
    this.thirtyDays.reduce((sum, d) => sum + d.total, 0),
  );
  readonly totalFora = computed(() =>
    this.thirtyDays.reduce((sum, d) => sum + d.outOfRange, 0),
  );
  readonly conformidade = computed(() => {
    const total = this.totalMedicoes();
    const fora = this.totalFora();
    return total ? `${(((total - fora) / total) * 100).toFixed(1)}%` : '100.0%';
  });
  readonly piorDia = computed(() => {
    const worst = [...this.thirtyDays].sort(
      (a, b) => b.outOfRange - a.outOfRange,
    )[0];
    return worst ? `${worst.dayLabel} · ${worst.outOfRange} leituras` : '—';
  });

  readonly chartDays = computed(() =>
    this.thirtyDays.map((d) => {
      const maxTotal = Math.max(...this.thirtyDays.map((x) => x.total));
      const heightPct = Math.max(6, Math.round((d.total / maxTotal) * 100));
      const outPct = d.total
        ? Math.round((d.outOfRange / d.total) * heightPct)
        : 0;
      return {
        ...d,
        heightPct,
        outPct,
        color: d.isWeekend ? 'var(--color-neutral-300)' : 'var(--color-accent)',
        tooltip: `${d.dayLabel} · ${d.total} medições · ${d.outOfRange} fora do limite`,
      };
    }),
  );

  readonly areaAnalysis = computed(() =>
    RISK_AREAS.map((area) => {
      const pets = this.state.pets().filter((p) => p.areas.includes(area.id));
      const occurrences = pets.filter((p) => p.status === 'ocorrencia').length;
      const rate = pets.length ? (occurrences / pets.length) * 100 : 0;
      const outOfRange = pets.reduce(
        (sum, p) => sum + buildMonitorArchive(p).outOfRange,
        0,
      );
      return {
        area,
        count: pets.length,
        occurrences,
        rate: `${rate.toFixed(0)}%`,
        ratePercent: rate,
        rateColor:
          rate > 15
            ? 'var(--status-bad)'
            : rate > 0
              ? 'var(--status-warn)'
              : 'var(--color-text)',
        barColor: rate > 15 ? 'var(--status-bad)' : 'var(--color-accent)',
        outOfRange,
      };
    }),
  );

  readonly incidents = computed(() =>
    this.state
      .pets()
      .filter((p) => p.status === 'ocorrencia')
      .map((p) => ({
        pet: p,
        cause:
          INCIDENT_CAUSE[p.id] ??
          'Ocorrência registrada durante a permissão. Detalhes no relatório interno do SESMT.',
        areaLabel: riskAreaNames(p.areas),
        nr: riskAreaNrs(p.areas),
        duration: p.durationMinutes ? minutesToLabel(p.durationMinutes) : '—',
        dateLabel: dateToBr(p.date),
      })),
  );

  readonly filteredHistory = computed(() => {
    const filter = this.historyFilter();
    const pets = [...this.state.pets()].sort((a, b) =>
      a.date < b.date ? 1 : -1,
    );
    const matches = (p: Pet) => {
      if (filter === 'todas') return true;
      if (
        filter === 'aberta' ||
        filter === 'fechada' ||
        filter === 'ocorrencia'
      )
        return p.status === filter;
      return p.areas.includes(filter);
    };
    return pets.filter(matches).map((p) => ({
      pet: p,
      status: petStatusView(p),
      areaLabel: riskAreaNames(p.areas),
      nr: riskAreaNrs(p.areas),
      dateLabel: dateToBr(p.date),
      duration: p.durationMinutes ? minutesToLabel(p.durationMinutes) : '—',
    }));
  });

  setHistoryFilter(filter: HistoryFilter): void {
    this.historyFilter.set(filter);
  }

  openReportModal(): void {
    this.reportModalOpen.set(true);
  }
  closeReportModal(): void {
    this.reportModalOpen.set(false);
  }
  setReportRange(days: number): void {
    const to = new Date(2026, 8, 5);
    const from = new Date(to.getTime() - days * 86400000);
    const pad = (v: number) => String(v).padStart(2, '0');
    this.reportFrom.set(
      `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`,
    );
    this.reportTo.set(
      `${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`,
    );
  }
  onReportFromChange(event: Event): void {
    this.reportFrom.set((event.target as HTMLInputElement).value);
  }
  onReportToChange(event: Event): void {
    this.reportTo.set((event.target as HTMLInputElement).value);
  }
  generateReport(): void {
    this.reportModalOpen.set(false);
    this.viewingReport.set(true);
  }
  closeReport(): void {
    this.viewingReport.set(false);
  }
  printReport(): void {
    window.print();
  }

  readonly reportPets = computed(() =>
    this.state
      .pets()
      .filter((p) => p.date >= this.reportFrom() && p.date <= this.reportTo())
      .map((p) => ({
        pet: p,
        status: petStatusView(p),
        dateLabel: dateToBr(p.date),
        nr: riskAreaNrs(p.areas),
        /**
         * As normas item a item, e não o texto já juntado.
         *
         * O hífen de "NR-10" é ponto de quebra de linha válido em CSS, então
         * a lista juntada saía do papel como "NR-33 · NR-" numa linha e "10"
         * na outra. Norma partida ao meio deixa de identificar a norma.
         * Renderizando cada uma num elemento próprio, a quebra só acontece
         * entre elas.
         */
        nrs: p.areas.map((a) => riskAreaNr(a)),
        duration: p.durationMinutes
          ? minutesToLabel(p.durationMinutes)
          : 'em andamento',
      })),
  );

  readonly reportSummary = computed(() => {
    const pets = this.reportPets();
    const occurrences = pets.filter(
      (p) => p.pet.status === 'ocorrencia',
    ).length;
    const totalTeam = pets.reduce((sum, p) => sum + p.pet.teamSize, 0);
    return [
      {
        label: 'PETs no período',
        value: String(pets.length),
        note: 'permissões emitidas',
      },
      {
        label: 'Ocorrências',
        value: String(occurrences),
        note: 'registradas no período',
      },
      {
        label: 'Pessoas envolvidas',
        value: String(totalTeam),
        note: 'soma das equipes autorizadas',
      },
      {
        label: 'Unidades',
        value: String(new Set(pets.map((p) => p.pet.unit)).size),
        note: 'unidades industriais',
      },
    ];
  });

  readonly reportTeams = computed(() =>
    this.reportPets().map(({ pet }) => ({
      pet,
      members: (pet.team ?? []).map((m) => ({
        ...m,
        roleLabel: PET_TEAM_ROLE_LABEL[m.petRole],
      })),
    })),
  );

  readonly reportMonitors = computed(() =>
    this.reportPets()
      .filter((p) => p.pet.gas)
      .map(({ pet }) => {
        const archive = buildMonitorArchive(pet);
        const rows = this.gasKeys.map((key) => {
          const limit = GAS_LIMITS[key];
          const [min, med, max] = archive.range[key];
          const withinLimit =
            max <= limit.max && (limit.min === undefined || min >= limit.min);
          return {
            label: limit.label,
            min: min.toFixed(limit.decimals),
            med: med.toFixed(limit.decimals),
            max: max.toFixed(limit.decimals),
            limit: limit.limitText,
            situation: withinLimit ? 'dentro do limite' : 'fora do limite',
            color: withinLimit ? 'var(--status-ok)' : 'var(--status-bad)',
          };
        });
        return {
          pet,
          readingCount: archive.readingCount,
          outOfRange: archive.outOfRange,
          rows,
        };
      }),
  );

  readonly reportDays = computed(() => {
    const from = this.reportFrom();
    const to = this.reportTo();
    const days = this.thirtyDays.filter((d) => d.iso >= from && d.iso <= to);
    const maxTotal = Math.max(1, ...days.map((d) => d.total));
    return days.map((d) => ({
      ...d,
      heightPct: Math.max(6, Math.round((d.total / maxTotal) * 100)),
    }));
  });
}

/**
 * Mensagem de erro da análise de IA em português, para o operador.
 *
 * Só repassa o texto quando ele vem mesmo do nosso back-end (corpo JSON com
 * `message`). Falha de rede (`status === 0`) devolve um `Error` do navegador
 * cuja `message` é "Failed to fetch" — texto técnico em inglês que não diz
 * nada a quem está no painel; nesses casos usa-se a explicação padrão.
 */
function aiErrorMessage(err: unknown): string {
  const fallback =
    'Não foi possível gerar a análise agora. Verifique se o back-end está no ar e se a chave da OpenAI está configurada.';
  if (!(err instanceof HttpErrorResponse) || err.status === 0) return fallback;
  const body = err.error as { message?: unknown } | string | null;
  if (typeof body === 'string' && body.trim()) return body;
  if (
    body &&
    typeof body === 'object' &&
    typeof body.message === 'string' &&
    body.message.trim()
  ) {
    return body.message;
  }
  return fallback;
}
