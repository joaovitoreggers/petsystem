import { Component, ElementRef, OnDestroy, ViewChild, computed, effect, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import jsQR from 'jsqr';
import { PetStateService } from '../pet-state.service';
import { TenancyApiService } from '../services/tenancy-api.service';
import {
  AREA_NOTE,
  ChecklistAnswer,
  CompanyLocation,
  GAS_LIMITS,
  GasKey,
  MOCK_BADGES,
  PetTeamRole,
  RISK_AREAS,
  RiskAreaId,
  STEP_NAME,
  TeamMember,
  buildChecklistGroups,
  decodeBadgeQr,
  isGasWithinLimit,
  riskAreaNrs,
} from '../pet-mock-data';
import { IconComponent } from '../../shared/icon.component';

interface GaugeView {
  key: GasKey;
  label: string;
  unit: string;
  value: string;
  color: string;
  limitText: string;
}

interface TeamRoleField {
  id: PetTeamRole;
  label: string;
  emptyLabel: string;
}

const TEAM_ROLE_FIELDS: TeamRoleField[] = [
  { id: 'equipe', label: 'Técnico', emptyLabel: 'Nenhum técnico adicionado ainda.' },
  { id: 'vigia', label: 'Vigia', emptyLabel: 'Nenhum vigia identificado ainda.' },
  { id: 'resgate', label: 'Socorrista', emptyLabel: 'Nenhum socorrista identificado ainda.' },
];

type WizardFieldName =
  | 'descricao'
  | 'tipo'
  | 'empresa'
  | 'telefone'
  | 'inicio'
  | 'fim'
  | 'local'
  | 'unidade';

export const PET_UNITS = [
  'Matelândia',
  'Medianeira',
  'Céu Azul',
  'Itaipulândia',
  'Missal',
];

export const EXECUTING_COMPANIES = [
  'Lar · Manutenção',
  'Lar · Armazéns',
  'Lar · SESMT',
  'Lar · Utilidades',
  'Termoeletro Ltda',
  'Altura Serviços ME',
];

export const SITE_LOCATIONS = [
  'Silo de milho 04',
  'Silo de soja 09',
  'Elevatória da ETE',
  'Casa de caldeiras 02',
  'Moega de recebimento 01',
  'Tanque de efluente 02',
  'Túnel de congelamento',
  'Torre de resfriamento',
  'Linha de extrusão',
  'Oficina de manutenção',
  'Subestação — pórtico 1',
  'Linha de abate — nória',
];

@Component({
  selector: 'app-pet-wizard',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './pet-wizard.component.html',
  styleUrls: ['./pet-wizard.component.scss', './pet-wizard-instruments.scss'],
})
export class PetWizardComponent implements OnDestroy {
  @ViewChild('tecnicoCanvas') tecnicoCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('execCanvas') execCanvasRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('photoInput') photoInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('qrVideo') qrVideoRef?: ElementRef<HTMLVideoElement>;

  readonly areas = RISK_AREAS;

  // Lista de unidades do seletor "Unidade" — parte de PET_UNITS (mock) e
  // troca pelas filiais reais do grupo da sessão assim que carregam. Sem
  // sessão ou se a chamada falhar, fica no mock — mesmo padrão de fallback
  // do resto do app.
  readonly unitOptions = signal<string[]>(PET_UNITS);

  constructor(
    readonly state: PetStateService,
    private readonly tenancyApi: TenancyApiService,
  ) {
    const companyGroupId = this.state.session()?.user.companyGroupId;
    if (companyGroupId) {
      this.loadBranchNames(companyGroupId);
    }
    // Avançar/voltar pra outra etapa com a câmera ligada não destrói o
    // componente (é o mesmo assistente, só troca o stepIndex) — sem isto
    // a câmera continuaria ligada em segundo plano depois que a etapa
    // "Crachá e permissão" saísse de tela.
    effect(() => {
      if (this.state.currentStep() !== 'qr') this.stopQrScan();
    });
  }

  private async loadBranchNames(companyGroupId: string): Promise<void> {
    try {
      const branches = await firstValueFrom(this.tenancyApi.findBranches(companyGroupId));
      if (branches.length > 0) {
        this.unitOptions.set(branches.map((b) => b.name).sort((a, b) => a.localeCompare(b)));
      }
    } catch {
      // mantém PET_UNITS como fallback
    }
  }

  triggerPhotoPicker(): void {
    this.photoInputRef?.nativeElement.click();
  }

  onPhotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => this.state.setSitePhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  removePhoto(event: Event): void {
    event.stopPropagation();
    this.state.setSitePhoto(null);
    if (this.photoInputRef) this.photoInputRef.nativeElement.value = '';
  }

  readonly stepLabel = computed(() => {
    const step = this.state.currentStep();
    return step ? STEP_NAME[step] : '';
  });
  readonly stepNumber = computed(() => this.state.stepIndex() + 1);
  readonly stepTotal = computed(() => this.state.steps().length);
  readonly stepBars = computed(() =>
    this.state
      .steps()
      .map((_, i) =>
        i <= this.state.stepIndex()
          ? 'var(--color-accent)'
          : 'var(--color-neutral-300)',
      ),
  );

  readonly selectedAreaNames = computed(() =>
    this.state
      .selectedAreas()
      .map((id) => RISK_AREAS.find((a) => a.id === id)?.name)
      .join(' + '),
  );
  readonly selectedNrs = computed(() =>
    riskAreaNrs(this.state.selectedAreas()),
  );
  readonly areaNotes = computed(() =>
    this.state.selectedAreas().map((id) => ({ id, text: AREA_NOTE[id] })),
  );

  // Leitura manual: o técnico digita o valor que leu no detector portátil —
  // sem simulação nem pareamento automático de aparelho.
  readonly gauges = computed<GaugeView[]>(() => {
    const inputs = this.state.gasInputs();
    const keys: GasKey[] = ['o2', 'co', 'h2s', 'lel'];
    return keys.map((key) => {
      const limit = GAS_LIMITS[key];
      const raw = inputs[key];
      const hasValue = raw.trim() !== '' && !Number.isNaN(Number(raw));
      const color = !hasValue
        ? 'var(--color-neutral-600)'
        : isGasWithinLimit(key, Number(raw))
          ? 'var(--status-ok)'
          : 'var(--status-bad)';
      return {
        key,
        label: limit.label,
        unit: limit.unit,
        value: raw,
        color,
        limitText: limit.limitText,
      };
    });
  });

  onGasInputChange(key: GasKey, event: Event): void {
    this.state.setGasInput(key, (event.target as HTMLInputElement).value);
  }

  readonly atmosphereOk = computed(() => !this.state.atmosphereOutOfRange());

  // EPI é um bloco único da PET (não repete por área), seguido pelo
  // checklist específico de cada área de risco selecionada.
  readonly checkGroups = computed(() =>
    buildChecklistGroups(this.state.selectedAreas()),
  );

  readonly checklistOptions: { value: ChecklistAnswer; label: string }[] = [
    { value: 'sim', label: 'SIM' },
    { value: 'nao', label: 'NÃO' },
    { value: 'na', label: 'NA' },
  ];

  checklistAnswer(key: string): ChecklistAnswer | undefined {
    return this.state.checklistAnswer(key);
  }

  setChecklistAnswer(key: string, answer: ChecklistAnswer): void {
    this.state.setChecklistAnswer(key, answer);
  }

  // Trabalho a quente (NR-18) não é uma área de risco selecionável no
  // momento (ver RiskAreaId em pet-mock-data.ts), então isto nunca é
  // verdadeiro hoje — mantido pronto para quando o escopo crescer de novo.
  readonly needsFireWatch = computed(() => false);

  onFireWatchTimeChange(index: number, event: Event): void {
    this.state.updateFireWatchRound(index, {
      hora: (event.target as HTMLInputElement).value,
    });
  }

  onFireWatchNameChange(index: number, event: Event): void {
    this.state.updateFireWatchRound(index, {
      nome: (event.target as HTMLInputElement).value,
    });
  }

  readonly companyOptions = EXECUTING_COMPANIES;

  // Nomes dos locais cadastrados pela empresa (ver "Locais" no menu); cai
  // para SITE_LOCATIONS só enquanto o cadastro real estiver vazio — mesmo
  // padrão de fallback do unitOptions acima.
  readonly locationOptions = computed(() => {
    const names = this.state.companyLocations().map((l) => l.name);
    return names.length > 0 ? names : SITE_LOCATIONS;
  });

  readonly badgeStatusLabel = (status: 'ok' | 'prox' | 'venc') =>
    status === 'ok' ? '✓' : status === 'prox' ? '!' : '✕';
  readonly badgeStatusColor = (status: 'ok' | 'prox' | 'venc') =>
    status === 'ok'
      ? 'var(--status-ok)'
      : status === 'prox'
        ? 'var(--status-warn)'
        : 'var(--status-bad)';

  readonly hasMoreBadgesToScan = computed(() => this.state.badgeCycleIndex() < MOCK_BADGES.length * 2);
  readonly teamRoleFields = TEAM_ROLE_FIELDS;

  onEmployeeSearchChange(event: Event): void {
    this.state.setEmployeeSearchQuery((event.target as HTMLInputElement).value);
  }

  selectEmployee(member: TeamMember): void {
    this.state.selectEmployeeFromSearch(member);
  }

  toggleAddPanel(role: PetTeamRole): void {
    this.stopQrScan();
    this.state.toggleAddPanel(role);
  }

  confirmAdd(): void {
    this.stopQrScan();
    this.state.confirmAddCurrentBadge();
  }

  // ── Leitura do QR do crachá pela câmera ───────────────────────────
  // O QR é gerado na tela Funcionários (ver PetTeamComponent.openQrDialog)
  // e codifica só a matrícula (decodeBadgeQr, em pet-mock-data.ts) — decodificado
  // aqui, resolve pro mesmo TeamMember que a busca por texto já resolvia.
  readonly qrScanning = signal(false);
  readonly qrScanError = signal<string | null>(null);

  private qrStream: MediaStream | null = null;
  private qrAnimationFrameId: number | null = null;
  private qrCanvas: HTMLCanvasElement | null = null;

  async startQrScan(): Promise<void> {
    this.qrScanError.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.qrScanError.set('Este navegador não permite acesso à câmera.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      this.qrStream = stream;
      this.qrScanning.set(true);
      // A tag <video> só existe no DOM depois do @if (qrScanning()) — espera
      // o próximo ciclo de detecção de mudanças pra achar a ref.
      queueMicrotask(() => {
        const video = this.qrVideoRef?.nativeElement;
        if (!video) return;
        video.srcObject = stream;
        video.play();
        this.qrAnimationFrameId = requestAnimationFrame(this.tickQrScan);
      });
    } catch (err) {
      this.qrScanError.set(qrCameraErrorMessage(err));
    }
  }

  stopQrScan(): void {
    if (this.qrAnimationFrameId !== null) {
      cancelAnimationFrame(this.qrAnimationFrameId);
      this.qrAnimationFrameId = null;
    }
    this.qrStream?.getTracks().forEach((track) => track.stop());
    this.qrStream = null;
    this.qrScanning.set(false);
  }

  private readonly tickQrScan = (): void => {
    const video = this.qrVideoRef?.nativeElement;
    if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
      this.qrAnimationFrameId = requestAnimationFrame(this.tickQrScan);
      return;
    }
    const canvas = (this.qrCanvas ??= document.createElement('canvas'));
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      this.qrAnimationFrameId = requestAnimationFrame(this.tickQrScan);
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(frame.data, frame.width, frame.height);
    if (code) {
      this.handleQrDecoded(code.data);
      return;
    }
    this.qrAnimationFrameId = requestAnimationFrame(this.tickQrScan);
  };

  private handleQrDecoded(text: string): void {
    this.stopQrScan();
    const registration = decodeBadgeQr(text);
    if (!registration) {
      this.qrScanError.set('QR code não reconhecido — não é um crachá do PET Digital.');
      return;
    }
    const member = this.state.teamMembers().find((m) => m.registration === registration);
    if (!member) {
      this.qrScanError.set(`Matrícula ${registration} não encontrada no cadastro de funcionários.`);
      return;
    }
    this.selectEmployee(member);
  }

  ngOnDestroy(): void {
    this.stopQrScan();
  }

  toggleArea(id: RiskAreaId): void {
    this.state.toggleArea(id);
  }

  // Escolher um local cadastrado pré-preenche área de risco, nome do local
  // e unidade (ver PetStateService.selectCompanyLocation) — o <select> volta
  // ao placeholder logo em seguida, porque isto é um atalho de preenchimento,
  // não um campo com valor próprio.
  pickCompanyLocation(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const location = this.state
      .companyLocations()
      .find((l: CompanyLocation) => l.id === select.value);
    if (location) this.state.selectCompanyLocation(location);
    select.value = '';
  }

  fieldValue(name: WizardFieldName): string {
    return this.state.fields()[name];
  }

  onFieldChange(name: WizardFieldName, event: Event): void {
    const value = (
      event.target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    ).value;
    this.state.setField(name, value);
  }

  clearSignature(which: 'tecnico' | 'exec'): void {
    const ref =
      which === 'tecnico' ? this.tecnicoCanvasRef : this.execCanvasRef;
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

  private drawPoint(
    event: PointerEvent,
    which: 'tecnico' | 'exec',
    start: boolean,
  ): void {
    const ref =
      which === 'tecnico' ? this.tecnicoCanvasRef : this.execCanvasRef;
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

/**
 * Por que a câmera não abriu, na linguagem de quem está em campo.
 *
 * getUserMedia só roda em contexto seguro — https, ou http em localhost.
 * Fora do celular do técnico acessando via IP da rede (não localhost), o
 * erro mais comum não é permissão negada, é o navegador nem oferecer a
 * API — daí o aviso específico sobre https, em vez de um genérico "sem
 * acesso à câmera" que mandaria a pessoa procurar a permissão errada.
 */
function qrCameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string })?.name;
  if (name === 'NotAllowedError') {
    return 'Permissão da câmera negada. Libere o acesso à câmera nas configurações do navegador e tente de novo.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Nenhuma câmera encontrada neste aparelho.';
  }
  if (!window.isSecureContext) {
    return 'A câmera só funciona em conexão segura (https). Acessando por IP na rede, use um endereço https.';
  }
  return 'Não foi possível abrir a câmera agora. Tente de novo.';
}
