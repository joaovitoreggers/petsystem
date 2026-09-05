import { Component, OnDestroy, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PetStateService } from '../pet-state.service';
import {
  GAS_LIMITS,
  GasKey,
  INCIDENT_CAUSE,
  PET_STATUS,
  Pet,
  RISK_AREAS,
  THIRTY_DAY_READINGS,
  buildMonitorArchive,
  dateToBr,
  minutesToLabel,
  riskAreaNames,
  riskAreaNrs,
} from '../pet-mock-data';
import { PetAnalysisApiService } from '../services/pet-analysis-api.service';

type HistoryFilter = 'todas' | 'aberta' | 'fechada' | 'ocorrencia' | 'confinado' | 'quente' | 'altura' | 'eletrico' | 'maquinas';

const HISTORY_FILTERS: { id: HistoryFilter; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'aberta', label: 'Abertas' },
  { id: 'fechada', label: 'Encerradas' },
  { id: 'ocorrencia', label: 'Ocorrências' },
  { id: 'confinado', label: 'Espaço confinado' },
  { id: 'quente', label: 'Trabalho a quente' },
  { id: 'altura', label: 'Trabalho em altura' },
];

@Component({
  selector: 'app-pet-manager',
  standalone: true,
  imports: [],
  templateUrl: './pet-manager.component.html',
  styleUrl: './pet-manager.component.scss',
})
export class PetManagerComponent implements OnDestroy {
  readonly gasKeys: GasKey[] = ['o2', 'co', 'h2s', 'lel'];
  readonly historyFilters = HISTORY_FILTERS;
  readonly thirtyDays = THIRTY_DAY_READINGS;

  readonly reportModalOpen = signal(false);
  readonly viewingReport = signal(false);
  readonly reportFrom = signal('2026-08-01');
  readonly reportTo = signal('2026-09-05');
  readonly historyFilter = signal<HistoryFilter>('todas');
  readonly evacuating = signal(false);

  readonly aiModalOpen = signal(false);
  readonly aiLoading = signal(false);
  readonly aiReport = signal<string | null>(null);
  readonly aiError = signal<string | null>(null);

  private audioContext: AudioContext | null = null;
  private sirenOscillator: OscillatorNode | null = null;
  private sirenIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly state: PetStateService,
    private readonly petAnalysisApi: PetAnalysisApiService,
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
    try {
      const result = await firstValueFrom(this.petAnalysisApi.analyze());
      this.aiReport.set(result.reportText);
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'error' in err && (err as { error?: { message?: string } }).error?.message
          ? (err as { error: { message: string } }).error.message
          : 'Não foi possível gerar a análise agora. Verifique se o back-end está no ar e se a chave da OpenAI está configurada.';
      this.aiError.set(message);
    } finally {
      this.aiLoading.set(false);
    }
  }

  ngOnDestroy(): void {
    this.stopSiren();
  }

  readonly alarmedPets = computed(() => this.state.pets().filter((p) => p.alarm && p.status !== 'fechada'));
  readonly hasAlert = computed(() => this.alarmedPets().length > 0);
  readonly alertText = computed(() => {
    const pet = this.alarmedPets()[0];
    if (!pet || !pet.gas) return '';
    return `${pet.id} · ${pet.location} · H₂S em ${pet.gas.h2s.toFixed(1)} ppm, acima do limite de 8 ppm.`;
  });
  readonly evacText = computed(() => {
    const pet = this.alarmedPets()[0];
    if (!pet) return 'Retirada imediata das frentes de trabalho ativas.';
    return `${pet.id} · ${pet.location} · ${riskAreaNrs(pet.areas)}. Atmosfera fora do limite: retirada imediata da frente de trabalho.`;
  });

  triggerEvacuation(): void {
    this.startSiren();
    this.evacuating.set(true);
  }

  silenceSiren(): void {
    this.stopSiren();
  }

  finishEvacuation(): void {
    this.stopSiren();
    this.evacuating.set(false);
  }

  private startSiren(): void {
    try {
      this.stopSiren();
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = (this.audioContext ??= new AudioCtx());
      if (ctx.state === 'suspended') ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(760, ctx.currentTime);
      gain.gain.setValueAtTime(0.055, ctx.currentTime);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      this.sirenOscillator = oscillator;
      let high = true;
      this.sirenIntervalId = setInterval(() => {
        high = !high;
        oscillator.frequency.setValueAtTime(high ? 760 : 520, ctx.currentTime);
      }, 420);
    } catch {
      // Web Audio unavailable — the visual alert still works without sound.
    }
  }

  private stopSiren(): void {
    if (this.sirenIntervalId !== null) {
      clearInterval(this.sirenIntervalId);
      this.sirenIntervalId = null;
    }
    if (this.sirenOscillator) {
      try {
        this.sirenOscillator.stop();
      } catch {
        // already stopped
      }
      this.sirenOscillator = null;
    }
  }

  readonly activePets = computed(() => this.state.pets().filter((p) => p.status !== 'fechada'));

  readonly kpis = computed(() => {
    const pets = this.state.pets();
    const open = pets.filter((p) => p.status !== 'fechada').length;
    const occurrences30d = pets.filter((p) => p.status === 'ocorrencia').length;
    const closed = pets.filter((p) => p.status === 'fechada' && p.durationMinutes);
    const avgMinutes = closed.length ? Math.round(closed.reduce((sum, p) => sum + (p.durationMinutes ?? 0), 0) / closed.length) : 0;
    const totalReadings = this.thirtyDays.reduce((sum, d) => sum + d.total, 0);
    const totalOut = this.thirtyDays.reduce((sum, d) => sum + d.outOfRange, 0);
    const compliance = totalReadings ? (((totalReadings - totalOut) / totalReadings) * 100).toFixed(1) : '100.0';
    return [
      { label: 'PETs ativas agora', value: String(open), note: 'em campo nas 5 unidades', color: 'var(--color-text)' },
      { label: 'Ocorrências registradas', value: String(occurrences30d), note: 'nos últimos 30 dias', color: occurrences30d > 0 ? 'var(--status-bad)' : 'var(--color-text)' },
      { label: 'Duração média', value: minutesToLabel(avgMinutes), note: 'permissões encerradas', color: 'var(--color-text)' },
      { label: 'Conformidade atmosférica', value: `${compliance}%`, note: 'leituras dentro do limite', color: 'var(--color-text)' },
    ];
  });

  readonly monitoredPetsView = computed(() =>
    this.activePets().map((pet) => ({
      pet,
      status: PET_STATUS[pet.alarm ? 'alarme' : pet.status],
      areaLabel: riskAreaNames(pet.areas),
      nr: riskAreaNrs(pet.areas),
    })),
  );

  readonly totalMedicoes = computed(() => this.thirtyDays.reduce((sum, d) => sum + d.total, 0));
  readonly totalFora = computed(() => this.thirtyDays.reduce((sum, d) => sum + d.outOfRange, 0));
  readonly conformidade = computed(() => {
    const total = this.totalMedicoes();
    const fora = this.totalFora();
    return total ? `${(((total - fora) / total) * 100).toFixed(1)}%` : '100.0%';
  });
  readonly piorDia = computed(() => {
    const worst = [...this.thirtyDays].sort((a, b) => b.outOfRange - a.outOfRange)[0];
    return worst ? `${worst.dayLabel} · ${worst.outOfRange} leituras` : '—';
  });

  readonly chartDays = computed(() =>
    this.thirtyDays.map((d) => {
      const maxTotal = Math.max(...this.thirtyDays.map((x) => x.total));
      const heightPct = Math.max(6, Math.round((d.total / maxTotal) * 100));
      const outPct = d.total ? Math.round((d.outOfRange / d.total) * heightPct) : 0;
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
      const outOfRange = pets.reduce((sum, p) => sum + buildMonitorArchive(p).outOfRange, 0);
      return {
        area,
        count: pets.length,
        occurrences,
        rate: `${rate.toFixed(0)}%`,
        ratePercent: rate,
        rateColor: rate > 15 ? 'var(--status-bad)' : rate > 0 ? 'var(--status-warn)' : 'var(--color-text)',
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
        cause: INCIDENT_CAUSE[p.id] ?? 'Ocorrência registrada durante a permissão. Detalhes no relatório interno do SESMT.',
        areaLabel: riskAreaNames(p.areas),
        nr: riskAreaNrs(p.areas),
        duration: p.durationMinutes ? minutesToLabel(p.durationMinutes) : '—',
        dateLabel: dateToBr(p.date),
      })),
  );

  readonly filteredHistory = computed(() => {
    const filter = this.historyFilter();
    const pets = [...this.state.pets()].sort((a, b) => (a.date < b.date ? 1 : -1));
    const matches = (p: Pet) => {
      if (filter === 'todas') return true;
      if (filter === 'aberta' || filter === 'fechada' || filter === 'ocorrencia') return p.status === filter;
      return p.areas.includes(filter);
    };
    return pets.filter(matches).map((p) => ({
      pet: p,
      status: PET_STATUS[p.alarm ? 'alarme' : p.status],
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
    this.reportFrom.set(`${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`);
    this.reportTo.set(`${to.getFullYear()}-${pad(to.getMonth() + 1)}-${pad(to.getDate())}`);
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
        status: PET_STATUS[p.alarm ? 'alarme' : p.status],
        dateLabel: dateToBr(p.date),
        nr: riskAreaNrs(p.areas),
        duration: p.durationMinutes ? minutesToLabel(p.durationMinutes) : 'em andamento',
      })),
  );

  readonly reportSummary = computed(() => {
    const pets = this.reportPets();
    const occurrences = pets.filter((p) => p.pet.status === 'ocorrencia').length;
    const totalTeam = pets.reduce((sum, p) => sum + p.pet.teamSize, 0);
    return [
      { label: 'PETs no período', value: String(pets.length), note: 'permissões emitidas' },
      { label: 'Ocorrências', value: String(occurrences), note: 'registradas no período' },
      { label: 'Pessoas envolvidas', value: String(totalTeam), note: 'soma das equipes autorizadas' },
      { label: 'Unidades', value: String(new Set(pets.map((p) => p.pet.unit)).size), note: 'unidades industriais' },
    ];
  });

  readonly reportMonitors = computed(() =>
    this.reportPets()
      .filter((p) => p.pet.gas)
      .map(({ pet }) => {
        const archive = buildMonitorArchive(pet);
        const rows = this.gasKeys.map((key) => {
          const limit = GAS_LIMITS[key];
          const [min, med, max] = archive.range[key];
          const withinLimit = max <= limit.max && (limit.min === undefined || min >= limit.min);
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
        return { pet, readingCount: archive.readingCount, outOfRange: archive.outOfRange, rows };
      }),
  );

  readonly reportDays = computed(() => {
    const from = this.reportFrom();
    const to = this.reportTo();
    const days = this.thirtyDays.filter((d) => d.iso >= from && d.iso <= to);
    const maxTotal = Math.max(1, ...days.map((d) => d.total));
    return days.map((d) => ({ ...d, heightPct: Math.max(6, Math.round((d.total / maxTotal) * 100)) }));
  });
}
