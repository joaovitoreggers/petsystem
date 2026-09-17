import {
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  ViewChild,
  afterNextRender,
  computed,
  effect,
  signal,
} from '@angular/core';
import { PetStateService } from '../pet-state.service';
import { AccessService } from '../services/access.service';
import {
  GAS_LIMITS,
  GasKey,
  petStatusView,
  Pet,
  isGasWithinLimit,
  riskAreaNames,
  riskAreaNrs,
} from '../pet-mock-data';
import { PetWizardComponent } from './pet-wizard.component';
import { IconComponent } from '../../shared/icon.component';
import { IndustrialArtComponent } from '../../shared/industrial-art.component';

interface PetCardView {
  pet: Pet;
  statusLabel: string;
  statusFg: string;
  statusBg: string;
  areaLabel: string;
  nr: string;
  gasLabel: string;
}

interface MeasurementFieldView {
  key: GasKey;
  label: string;
  unit: string;
  value: string;
  color: string;
  limitText: string;
}

@Component({
  selector: 'app-pet-technician',
  standalone: true,
  imports: [PetWizardComponent, IconComponent, IndustrialArtComponent],
  templateUrl: './pet-technician.component.html',
  styleUrls: ['./pet-technician.component.scss', './pet-login.scss'],
})
export class PetTechnicianComponent implements OnDestroy {
  // O <video> só existe no DOM quando cameraActive() vira true (@if no
  // template), então o ViewChild só é preenchido depois que o Angular
  // renderiza esse @if — daí o afterNextRender abaixo em vez de acessar
  // faceVideoRef logo após o .set(true). Sem isso, srcObject podia nunca
  // ser atribuído: a câmera ficava ligada (getUserMedia já resolvido) mas
  // sem imagem, e sem nova tentativa depois.
  @ViewChild('faceVideo')
  private readonly faceVideoRef?: ElementRef<HTMLVideoElement>;
  // Vídeo próprio do diálogo de cadastro de reconhecimento facial: ele
  // pode aparecer depois de um login pela aba "E-mail e senha", onde o
  // #faceVideo acima nunca chegou a existir no DOM (só renderiza dentro
  // da aba "Reconhecimento facial"). Os dois compartilham o mesmo
  // MediaStream — startCamera() atribui a ambos quando existirem.
  @ViewChild('enrollVideo')
  private readonly enrollVideoRef?: ElementRef<HTMLVideoElement>;

  readonly cameraActive = signal(false);

  /** Quem pode abrir uma PET, segundo o servidor. */
  readonly podeEmitirPet = computed(() => this.access.pode()('emitir_pet'));

  /** Quem pode medir e encerrar uma PET já aberta. */
  readonly podeOperarPet = computed(() => this.access.pode()('operar_pet'));

  /**
   * A câmera está barrada pela origem, e não por falta de permissão?
   *
   * Navegador nenhum entrega câmera fora de um contexto seguro: só em
   * HTTPS ou em localhost. Aberto pelo IP da rede em http://, o
   * `navigator.mediaDevices` simplesmente não existe — e aí "toque para
   * tentar de novo" é uma instrução falsa, porque tentar de novo nunca vai
   * funcionar. Quando é este o caso, a tela diz o motivo de verdade.
   */
  readonly cameraBlockedByOrigin = signal(false);
  readonly cameraError = signal(false);
  private cameraStream: MediaStream | null = null;

  constructor(
    readonly state: PetStateService,
    readonly access: AccessService,
    private readonly injector: Injector,
  ) {
    effect(() => {
      if (this.state.screen() === 'login') {
        this.startCamera();
      } else {
        this.stopCamera();
      }
    });
    // O diálogo de cadastro (#enrollVideo) só existe no DOM quando
    // enrollPromptOpen vira true, o que costuma acontecer bem depois da
    // câmera já ter ligado — precisa da própria atribuição de srcObject,
    // não só a que startCamera() já fez pro #faceVideo.
    effect(() => {
      if (this.state.enrollPromptOpen() && this.cameraStream) {
        this.attachStreamToVideo(() => this.enrollVideoRef, this.cameraStream);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  // Recebe uma função que LÊ o ViewChild, não o ViewChild já resolvido: no
  // primeiro ciclo em que o @if que monta o <video> vira verdadeiro, a
  // propriedade ainda está undefined nesse exato instante (Angular só a
  // preenche durante a checagem de view que roda depois). Capturar o valor
  // na hora da chamada prendia esse undefined pra sempre no closure, mesmo
  // o afterNextRender rodando depois — o vídeo nunca recebia o
  // MediaStream, ficava 0x0/paused, e o face-api travava tentando detectar
  // rosto num frame que não existia.
  private attachStreamToVideo(
    getRef: () => ElementRef<HTMLVideoElement> | undefined,
    stream: MediaStream,
  ): void {
    afterNextRender(
      () => {
        const video = getRef()?.nativeElement;
        if (!video) return;
        video.srcObject = stream;
        video.play().catch(() => undefined);
      },
      { injector: this.injector },
    );
  }

  private async startCamera(): Promise<void> {
    if (this.cameraStream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraBlockedByOrigin.set(!window.isSecureContext);
      this.cameraError.set(true);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      this.cameraStream = stream;
      this.cameraError.set(false);
      this.cameraBlockedByOrigin.set(false);
      this.cameraActive.set(true);
      this.attachStreamToVideo(() => this.faceVideoRef, stream);
    } catch {
      // Chegou aqui com a API disponível: foi recusa de permissão ou câmera
      // ocupada — nesses casos tentar de novo faz sentido.
      this.cameraBlockedByOrigin.set(false);
      this.cameraError.set(true);
      this.cameraActive.set(false);
    }
  }

  private stopCamera(): void {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
    this.cameraActive.set(false);
  }

  readonly visibleCards = computed<PetCardView[]>(() =>
    this.state.visiblePets().map((pet) => this.toCard(pet)),
  );

  readonly detailPet = computed<Pet | undefined>(() =>
    this.state.pets().find((p) => p.id === this.state.detailPetId()),
  );
  readonly detailCard = computed<PetCardView | undefined>(() => {
    const pet = this.detailPet();
    return pet ? this.toCard(pet) : undefined;
  });

  readonly emittedPet = computed<Pet | undefined>(() =>
    this.state.pets().find((p) => p.id === this.state.emittedPetId()),
  );

  readonly faceTitle = computed(() => {
    switch (this.state.authPhase()) {
      case 'scan':
        return 'Validando identidade…';
      case 'ok':
        return 'Identidade confirmada';
      default:
        return this.state.hasFaceEnrollment() ? 'Reconhecimento facial' : 'Nenhum rosto cadastrado';
    }
  });
  readonly faceText = computed(() => {
    switch (this.state.authPhase()) {
      case 'scan':
        return 'Mantenha o rosto centralizado no quadro.';
      case 'ok':
        return 'Identidade confirmada. Carregando suas permissões…';
      default:
        if (this.state.faceAuthError()) return this.state.faceAuthError() as string;
        return this.state.hasFaceEnrollment()
          ? 'Posicione o rosto para acessar o PET Digital com sua credencial.'
          : 'Entre por e-mail e senha uma vez para habilitar o reconhecimento facial neste aparelho.';
    }
  });
  readonly faceColor = computed(() =>
    this.state.authPhase() === 'ok' ? 'var(--status-ok)' : 'var(--color-bg)',
  );
  readonly faceScanning = computed(() => this.state.authPhase() === 'scan');
  readonly faceButtonLabel = computed(() => {
    if (this.state.authPhase() !== 'idle') return 'Aguarde…';
    return this.state.hasFaceEnrollment()
      ? 'Iniciar reconhecimento facial'
      : 'Entre por e-mail e senha';
  });
  readonly faceButtonDisabled = computed(
    () => this.state.authPhase() !== 'idle' || !this.state.hasFaceEnrollment(),
  );

  startAuth(): void {
    if (!this.state.hasFaceEnrollment()) {
      this.state.setAuthMethod('senha');
      return;
    }
    void this.state.startFacialRecognition(this.faceVideoRef?.nativeElement ?? null);
  }

  // ── Cadastro de reconhecimento facial (depois de um login real) ─────
  confirmEnroll(): void {
    void this.state.confirmFaceEnrollment(this.enrollVideoRef?.nativeElement ?? null);
  }

  skipEnroll(): void {
    this.state.skipFaceEnrollment();
  }

  // ── Acesso por e-mail e senha ───────────────────────────────────────
  readonly passwordVisible = signal(false);

  togglePasswordVisible(): void {
    this.passwordVisible.update((v) => !v);
  }

  onLoginEmail(event: Event): void {
    this.state.setLoginEmail((event.target as HTMLInputElement).value);
  }

  onLoginPassword(event: Event): void {
    this.state.setLoginPassword((event.target as HTMLInputElement).value);
  }

  /** Enter no formulário entra, como em qualquer tela de login. */
  submitLogin(event: Event): void {
    event.preventDefault();
    this.state.loginWithPassword();
  }

  readonly cancelDialogOpen = signal(false);
  readonly cancelReason = signal('');
  readonly cancelClosedBy = signal('');

  readonly canConfirmCancel = computed(
    () =>
      this.cancelReason().trim().length > 0 &&
      this.cancelClosedBy().trim().length > 0,
  );

  openCancelDialog(): void {
    this.cancelReason.set('');
    this.cancelClosedBy.set('');
    this.cancelDialogOpen.set(true);
  }

  closeCancelDialog(): void {
    this.cancelDialogOpen.set(false);
  }

  onCancelReasonChange(event: Event): void {
    this.cancelReason.set((event.target as HTMLTextAreaElement).value);
  }

  onCancelClosedByChange(event: Event): void {
    this.cancelClosedBy.set((event.target as HTMLInputElement).value);
  }

  confirmCancel(): void {
    if (!this.canConfirmCancel()) return;
    this.state.encerrarPet(
      this.cancelReason().trim(),
      this.cancelClosedBy().trim(),
    );
    this.cancelDialogOpen.set(false);
  }

  // Leitura manual pós-emissão: mesmo padrão da etapa 3 do assistente,
  // sem sensor conectado.
  readonly measurementFields = computed<MeasurementFieldView[]>(() => {
    const inputs = this.state.measurementGasInputs();
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

  openMeasurement(): void {
    this.state.openMeasurementDialog();
  }

  closeMeasurement(): void {
    this.state.closeMeasurementDialog();
  }

  onMeasurementGasInputChange(key: GasKey, event: Event): void {
    this.state.setMeasurementGasInput(
      key,
      (event.target as HTMLInputElement).value,
    );
  }

  confirmMeasurement(): void {
    this.state.confirmMeasurement();
  }

  private toCard(pet: Pet): PetCardView {
    const status = petStatusView(pet);
    const gasLabel = pet.gas ? `O₂ ${pet.gas.o2.toFixed(1)}%` : 'sem gases';
    return {
      pet,
      statusLabel: status.label,
      statusFg: status.fg,
      statusBg: status.bg,
      areaLabel: riskAreaNames(pet.areas),
      nr: riskAreaNrs(pet.areas),
      gasLabel,
    };
  }
}
