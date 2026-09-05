import { Component, ElementRef, ViewChild, computed, effect } from '@angular/core';
import { PetStateService } from '../pet-state.service';
import {
  AREA_NOTE,
  CHECKLISTS,
  GAS_LIMITS,
  MOCK_BADGES,
  RISK_AREAS,
  RiskAreaId,
  STEP_NAME,
  isGasWithinLimit,
  riskAreaNrs,
} from '../pet-mock-data';

interface GaugeView {
  key: 'o2' | 'co' | 'h2s' | 'lel';
  label: string;
  unit: string;
  value: string;
  color: string;
  percent: number;
  limitText: string;
}

type WizardFieldName = 'descricao' | 'tipo' | 'empresa' | 'inicio' | 'fim' | 'local';

@Component({
  selector: 'app-pet-wizard',
  standalone: true,
  imports: [],
  templateUrl: './pet-wizard.component.html',
  styleUrl: './pet-wizard.component.scss',
})
export class PetWizardComponent {
  @ViewChild('tecnicoCanvas') tecnicoCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('execCanvas') execCanvasRef?: ElementRef<HTMLCanvasElement>;

  readonly areas = RISK_AREAS;

  constructor(readonly state: PetStateService) {
    effect(() => {
      if (this.state.currentStep() === 'gases') {
        this.state.startGasSimulation();
      }
    });
  }

  readonly stepLabel = computed(() => {
    const step = this.state.currentStep();
    return step ? STEP_NAME[step] : '';
  });
  readonly stepNumber = computed(() => this.state.stepIndex() + 1);
  readonly stepTotal = computed(() => this.state.steps().length);
  readonly stepBars = computed(() =>
    this.state.steps().map((_, i) => (i <= this.state.stepIndex() ? 'var(--color-accent)' : 'var(--color-neutral-300)')),
  );

  readonly selectedAreaNames = computed(() =>
    this.state
      .selectedAreas()
      .map((id) => RISK_AREAS.find((a) => a.id === id)?.name)
      .join(' + '),
  );
  readonly selectedNrs = computed(() => riskAreaNrs(this.state.selectedAreas()));
  readonly areaNotes = computed(() => this.state.selectedAreas().map((id) => ({ id, text: AREA_NOTE[id] })));

  readonly extraGroups = computed(() =>
    this.state.extraFieldsForSelection().map((group) => ({
      ...group,
      title: `Dados específicos · ${RISK_AREAS.find((a) => a.id === group.areaId)?.nr}`,
    })),
  );

  readonly gauges = computed<GaugeView[]>(() => {
    const gas = this.state.liveGas();
    const keys: GaugeView['key'][] = ['o2', 'co', 'h2s', 'lel'];
    return keys.map((key) => {
      const limit = GAS_LIMITS[key];
      const value = gas[key];
      const ok = isGasWithinLimit(key, value);
      const pct = Math.min(100, Math.round((value / limit.scaleMax) * 100));
      return {
        key,
        label: limit.label,
        unit: limit.unit,
        value: value.toFixed(limit.decimals),
        color: ok ? 'var(--status-ok)' : 'var(--status-bad)',
        percent: pct,
        limitText: limit.limitText,
      };
    });
  });

  readonly atmosphereOk = computed(() => !this.state.atmosphereOutOfRange());

  readonly checkGroups = computed(() =>
    this.state.selectedAreas().flatMap((areaId) =>
      CHECKLISTS[areaId].map((group, groupIndex) => ({
        title: `${group.title}`,
        areaId,
        items: group.items.map((label, itemIndex) => ({
          key: `${areaId}:${groupIndex}:${itemIndex}`,
          label,
        })),
      })),
    ),
  );

  readonly badgeStatusLabel = (status: 'ok' | 'prox' | 'venc') =>
    status === 'ok' ? '✓' : status === 'prox' ? '!' : '✕';
  readonly badgeStatusColor = (status: 'ok' | 'prox' | 'venc') =>
    status === 'ok' ? 'var(--status-ok)' : status === 'prox' ? 'var(--status-warn)' : 'var(--status-bad)';

  readonly hasMoreBadgesToScan = computed(() => this.state.badgeCycleIndex() < MOCK_BADGES.length * 2);

  toggleArea(id: RiskAreaId): void {
    this.state.toggleArea(id);
  }

  fieldValue(name: WizardFieldName): string {
    return this.state.fields()[name];
  }

  onFieldChange(name: WizardFieldName, event: Event): void {
    const value = (event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
    this.state.setField(name, value);
  }

  onExtraChange(name: string, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.state.setExtra(name, value);
  }

  clearSignature(which: 'tecnico' | 'exec'): void {
    const ref = which === 'tecnico' ? this.tecnicoCanvasRef : this.execCanvasRef;
    const canvas = ref?.nativeElement;
    if (canvas) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (which === 'tecnico') this.state.setTechnicianSigned(false);
    else this.state.setExecutorSigned(false);
  }

  private drawing = false;

  startDraw(event: PointerEvent, which: 'tecnico' | 'exec'): void {
    this.drawing = true;
    this.drawPoint(event, which, true);
  }
  moveDraw(event: PointerEvent, which: 'tecnico' | 'exec'): void {
    if (!this.drawing) return;
    this.drawPoint(event, which, false);
  }
  endDraw(): void {
    this.drawing = false;
  }

  private drawPoint(event: PointerEvent, which: 'tecnico' | 'exec', start: boolean): void {
    const ref = which === 'tecnico' ? this.tecnicoCanvasRef : this.execCanvasRef;
    const canvas = ref?.nativeElement;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#1d1f20';
    if (start) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    if (which === 'tecnico') this.state.setTechnicianSigned(true);
    else this.state.setExecutorSigned(true);
  }
}
