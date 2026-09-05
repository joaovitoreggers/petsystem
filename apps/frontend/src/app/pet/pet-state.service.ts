import { Injectable, computed, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Badge,
  EXTRA_FIELDS,
  GasReading,
  MOCK_BADGES,
  MOCK_PETS,
  Pet,
  RiskAreaId,
  TEAM_MEMBERS,
  TeamMember,
  WizardStepId,
  requiresGasMonitoring,
  riskAreaNrs,
  stepsFor,
} from './pet-mock-data';
import { WorkPermitsApiService } from './services/work-permits-api.service';
import { TeamMembersApiService } from './services/team-members-api.service';

export type PortalRole = 'tecnico' | 'gestor' | 'equipe';
export type TechnicianScreen = 'login' | 'home' | 'nova' | 'emitida' | 'detalhe';
export type HomeTab = 'abertas' | 'fechadas';
export type AuthPhase = 'idle' | 'scan' | 'ok';

interface WizardFields {
  descricao: string;
  tipo: string;
  empresa: string;
  inicio: string;
  fim: string;
  local: string;
}

const EMPTY_FIELDS: WizardFields = { descricao: '', tipo: 'Manutenção corretiva', empresa: '', inicio: '', fim: '', local: '' };

export interface ManualExtraField {
  id: string;
  label: string;
  value: string;
}

let nextPetSequence = 419;
let nextManualFieldSequence = 1;

@Injectable({ providedIn: 'root' })
export class PetStateService {
  readonly role = signal<PortalRole>('tecnico');

  // ── Alerta e evacuação ──────────────────────────────────────────────
  // Vive aqui (não num componente) para ficar disponível em qualquer tela —
  // trocar de aba (técnico/gestor/funcionários) não deve silenciar a sirene
  // nem fechar o alerta de uma evacuação em curso.
  readonly evacuating = signal(false);

  private audioContext: AudioContext | null = null;
  private sirenOscillator: OscillatorNode | null = null;
  private sirenIntervalId: ReturnType<typeof setInterval> | null = null;

  readonly alarmedPets = computed(() => this.pets().filter((p) => p.alarm && p.status !== 'fechada'));
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
      const AudioCtx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      // Web Audio unavailable — o alerta visual continua funcionando sem som.
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
        // já parado
      }
      this.sirenOscillator = null;
    }
  }

  // Estado inicial vem dos dados mockados; loadFromBackend() (chamado no
  // constructor) tenta substituí-lo pelo conteúdo real da API assim que o
  // back-end responde. Se a chamada falhar (back-end fora do ar, por
  // exemplo), a tela continua funcionando normalmente com o mock — é assim
  // que o MVP evita depender do back-end estar de pé para ser demonstrado.
  readonly pets = signal<Pet[]>([...MOCK_PETS]);
  readonly teamMembers = signal<TeamMember[]>([...TEAM_MEMBERS]);

  constructor(
    private readonly workPermitsApi: WorkPermitsApiService,
    private readonly teamMembersApi: TeamMembersApiService,
  ) {
    this.loadFromBackend();
  }

  private async loadFromBackend(): Promise<void> {
    try {
      const pets = await firstValueFrom(this.workPermitsApi.findAll());
      if (pets.length > 0) this.pets.set(pets);
    } catch {
      // mantém os dados mockados como estão
    }
    try {
      const members = await firstValueFrom(this.teamMembersApi.findAll());
      if (members.length > 0) this.teamMembers.set(members);
    } catch {
      // mantém os dados mockados como estão
    }
  }

  async registerTeamMember(member: TeamMember): Promise<void> {
    try {
      const created = await firstValueFrom(this.teamMembersApi.create(member));
      this.teamMembers.update((list) => [...list, created]);
    } catch {
      this.teamMembers.update((list) => [...list, member]);
    }
  }

  // ── Técnico: navegação e autenticação ──────────────────────────────
  readonly screen = signal<TechnicianScreen>('login');
  readonly authPhase = signal<AuthPhase>('idle');
  readonly homeTab = signal<HomeTab>('abertas');
  readonly detailPetId = signal<string | null>(null);
  readonly emittedPetId = signal<string | null>(null);

  readonly openPets = computed(() => this.pets().filter((p) => p.status !== 'fechada'));
  readonly closedPets = computed(() => this.pets().filter((p) => p.status === 'fechada'));
  readonly visiblePets = computed(() => (this.homeTab() === 'abertas' ? this.openPets() : this.closedPets()));

  // ── Wizard "Nova PET" ───────────────────────────────────────────────
  readonly selectedAreas = signal<RiskAreaId[]>([]);
  readonly stepIndex = signal(0);
  readonly fields = signal<WizardFields>({ ...EMPTY_FIELDS });
  readonly extraValues = signal<Record<string, string>>({});
  readonly manualExtraFields = signal<Record<string, ManualExtraField[]>>({});
  readonly checklistState = signal<Record<string, boolean>>({});
  readonly liveGas = signal<GasReading>({ o2: 20.9, co: 2, h2s: 0.3, lel: 1 });
  readonly ventilationOn = signal(false);
  readonly gasReadingsLog = signal<{ time: string; text: string }[]>([]);
  readonly currentBadge = signal<Badge | null>(null);
  readonly badgeCycleIndex = signal(0);
  readonly authorizedTeam = signal<Badge[]>([]);
  readonly technicianSigned = signal(false);
  readonly executorSigned = signal(false);

  readonly steps = computed<WizardStepId[]>(() => stepsFor(this.selectedAreas()));
  readonly currentStep = computed<WizardStepId | undefined>(() => this.steps()[this.stepIndex()]);
  readonly needsGasMonitoring = computed(() => requiresGasMonitoring(this.selectedAreas()));

  private gasIntervalId: ReturnType<typeof setInterval> | null = null;

  setRole(role: PortalRole): void {
    this.role.set(role);
  }

  // ── Login simulado ──────────────────────────────────────────────────
  startAuth(): void {
    if (this.authPhase() !== 'idle') return;
    this.authPhase.set('scan');
    setTimeout(() => {
      this.authPhase.set('ok');
      setTimeout(() => {
        this.authPhase.set('idle');
        this.screen.set('home');
      }, 500);
    }, 1600);
  }

  logout(): void {
    this.screen.set('login');
    this.authPhase.set('idle');
  }

  selectHomeTab(tab: HomeTab): void {
    this.homeTab.set(tab);
  }

  openPetDetail(id: string): void {
    this.detailPetId.set(id);
    this.screen.set('detalhe');
  }

  goHome(): void {
    this.stopGasSimulation();
    this.screen.set('home');
  }

  async encerrarPet(): Promise<void> {
    const id = this.detailPetId();
    if (!id) return;
    const pet = this.pets().find((p) => p.id === id);
    const end = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const durationMinutes = pet ? minutesSince(pet.start) : 0;
    try {
      const closed = await firstValueFrom(this.workPermitsApi.close(id, { end, durationMinutes }));
      this.pets.update((list) => list.map((p) => (p.id === id ? closed : p)));
    } catch {
      this.pets.update((list) =>
        list.map((p) => (p.id === id ? { ...p, status: 'fechada' as const, end, durationMinutes } : p)),
      );
    }
    this.goHome();
  }

  // ── Wizard ────────────────────────────────────────────────────────
  startNewPet(): void {
    this.selectedAreas.set([]);
    this.stepIndex.set(0);
    this.fields.set({ ...EMPTY_FIELDS });
    this.extraValues.set({});
    this.manualExtraFields.set({});
    this.checklistState.set({});
    this.ventilationOn.set(false);
    this.gasReadingsLog.set([]);
    this.currentBadge.set(null);
    this.badgeCycleIndex.set(0);
    this.authorizedTeam.set([]);
    this.technicianSigned.set(false);
    this.executorSigned.set(false);
    this.screen.set('nova');
  }

  editArea(): void {
    this.stepIndex.set(0);
  }

  toggleArea(id: RiskAreaId): void {
    this.selectedAreas.update((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  setField<K extends keyof WizardFields>(name: K, value: string): void {
    this.fields.update((f) => ({ ...f, [name]: value }));
  }

  setExtra(name: string, value: string): void {
    this.extraValues.update((v) => ({ ...v, [name]: value }));
  }

  extraFieldsForSelection(): { areaId: RiskAreaId; areaLabel: string; fields: { name: string; label: string; value: string }[] }[] {
    return this.selectedAreas().map((id) => ({
      areaId: id,
      areaLabel: id,
      // Preenchimento manual: os campos começam vazios — EXTRA_FIELDS só
      // fornece o rótulo, não é mais usado como valor pré-preenchido.
      fields: EXTRA_FIELDS[id].map((f) => ({ name: `${id}:${f.name}`, label: f.label, value: this.extraValues()[`${id}:${f.name}`] ?? '' })),
    }));
  }

  // Além dos campos pré-definidos por NR acima, o técnico também pode
  // lançar dados manuais — um rótulo + valor livres — para a mesma NR.
  // Cada área selecionada tem sua própria lista, e todas se combinam na
  // mesma PET quando várias áreas são marcadas.
  manualFieldsForArea(areaId: RiskAreaId): ManualExtraField[] {
    return this.manualExtraFields()[areaId] ?? [];
  }

  addManualExtraField(areaId: RiskAreaId): void {
    const field: ManualExtraField = { id: `manual-${nextManualFieldSequence++}`, label: '', value: '' };
    this.manualExtraFields.update((state) => ({
      ...state,
      [areaId]: [...(state[areaId] ?? []), field],
    }));
  }

  updateManualExtraField(areaId: RiskAreaId, id: string, patch: Partial<Pick<ManualExtraField, 'label' | 'value'>>): void {
    this.manualExtraFields.update((state) => ({
      ...state,
      [areaId]: (state[areaId] ?? []).map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }

  removeManualExtraField(areaId: RiskAreaId, id: string): void {
    this.manualExtraFields.update((state) => ({
      ...state,
      [areaId]: (state[areaId] ?? []).filter((f) => f.id !== id),
    }));
  }

  toggleChecklistItem(key: string): void {
    this.checklistState.update((state) => ({ ...state, [key]: !state[key] }));
  }

  isChecklistItemChecked(key: string): boolean {
    return !!this.checklistState()[key];
  }

  // ── Gases ao vivo ────────────────────────────────────────────────
  startGasSimulation(): void {
    this.stopGasSimulation();
    this.gasIntervalId = setInterval(() => {
      this.liveGas.update((gas) => {
        const drift = this.ventilationOn() ? -0.6 : 0.9;
        const jitter = () => (Math.random() - 0.5) * 0.6;
        return {
          o2: clamp(gas.o2 + (this.ventilationOn() ? 0.05 : -0.03) + jitter() * 0.1, 18, 21.5),
          co: clamp(gas.co + jitter(), 0, 40),
          h2s: clamp(gas.h2s + drift * 0.4 + jitter() * 0.3, 0, 18),
          lel: clamp(gas.lel + jitter() * 0.5, 0, 25),
        };
      });
    }, 900);
  }

  stopGasSimulation(): void {
    if (this.gasIntervalId !== null) {
      clearInterval(this.gasIntervalId);
      this.gasIntervalId = null;
    }
  }

  toggleVentilation(): void {
    this.ventilationOn.update((v) => !v);
  }

  registerReading(): void {
    const gas = this.liveGas();
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const text = `O₂ ${gas.o2.toFixed(1)}% · CO ${gas.co.toFixed(0)} ppm · H₂S ${gas.h2s.toFixed(1)} ppm · LEL ${gas.lel.toFixed(0)}%`;
    this.gasReadingsLog.update((log) => [{ time, text }, ...log]);
  }

  atmosphereOutOfRange(): boolean {
    const gas = this.liveGas();
    return gas.o2 < 19.5 || gas.o2 > 23 || gas.co > 25 || gas.h2s > 8 || gas.lel > 10;
  }

  // ── Crachá ────────────────────────────────────────────────────────
  scanBadge(): void {
    const idx = this.badgeCycleIndex() % MOCK_BADGES.length;
    this.currentBadge.set(MOCK_BADGES[idx]);
    this.badgeCycleIndex.update((i) => i + 1);
  }

  addBadgeToTeam(): void {
    const badge = this.currentBadge();
    if (!badge) return;
    if (!this.authorizedTeam().some((b) => b.registration === badge.registration)) {
      this.authorizedTeam.update((team) => [...team, badge]);
    }
    this.currentBadge.set(null);
  }

  badgeIsCleared(badge: Badge): boolean {
    return !badge.items.some((i) => i.status === 'venc');
  }

  // ── Assinaturas ──────────────────────────────────────────────────
  setTechnicianSigned(v: boolean): void {
    this.technicianSigned.set(v);
  }
  setExecutorSigned(v: boolean): void {
    this.executorSigned.set(v);
  }

  // ── Navegação do wizard ──────────────────────────────────────────
  canAdvance(): boolean {
    const step = this.currentStep();
    if (step === 'area') return this.selectedAreas().length > 0;
    if (step === 'gases') return !this.atmosphereOutOfRange();
    if (step === 'qr') return this.authorizedTeam().length > 0;
    if (step === 'sig') return this.technicianSigned() && this.executorSigned();
    return true;
  }

  advanceStepLabel(): string {
    const steps = this.steps();
    const isLast = this.stepIndex() === steps.length - 1;
    return isLast ? 'Emitir PET' : 'Avançar';
  }

  back(): void {
    if (this.screen() !== 'nova') {
      this.goHome();
      return;
    }
    if (this.stepIndex() === 0) {
      this.goHome();
      return;
    }
    if (this.currentStep() === 'gases') this.stopGasSimulation();
    this.stepIndex.update((i) => i - 1);
  }

  advance(): void {
    if (!this.canAdvance()) return;
    const steps = this.steps();
    const isLast = this.stepIndex() === steps.length - 1;
    if (isLast) {
      this.finishPet();
      return;
    }
    if (this.currentStep() === 'gases') this.stopGasSimulation();
    this.stepIndex.update((i) => i + 1);
    if (this.currentStep() === 'gases') this.startGasSimulation();
  }

  private async finishPet(): Promise<void> {
    const fields = this.fields();
    const now = new Date();
    const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const areas = this.selectedAreas();
    const gas = this.needsGasMonitoring() ? this.liveGas() : undefined;
    const payload = {
      areas,
      location: fields.local || 'Local não informado',
      unit: 'Matelândia',
      teamSize: this.authorizedTeam().length,
      date: now.toISOString().slice(0, 10),
      start: time,
      technician: 'Bárbara M. Garlini',
      coordinates: '-25.2531, -53.9927',
      gas,
    };

    let pet: Pet;
    try {
      pet = await firstValueFrom(this.workPermitsApi.create(payload));
    } catch {
      pet = {
        id: `PET-2026-${String(nextPetSequence++).padStart(4, '0')}`,
        areas,
        location: payload.location,
        unit: payload.unit,
        teamSize: payload.teamSize,
        date: payload.date,
        start: time,
        end: '',
        timeLabel: time,
        technician: payload.technician,
        status: 'aberta',
        coordinates: payload.coordinates,
        gas,
      };
    }
    this.pets.update((list) => [pet, ...list]);
    this.emittedPetId.set(pet.id);
    this.screen.set('emitida');
  }
}

function minutesSince(startHHmm: string): number {
  const [hours, minutes] = startHHmm.split(':').map(Number);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours || 0, minutes || 0);
  return Math.max(1, Math.round((now.getTime() - start.getTime()) / 60000));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
