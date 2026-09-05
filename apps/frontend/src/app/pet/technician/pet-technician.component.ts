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
import { PET_STATUS, Pet, riskAreaNames, riskAreaNrs } from '../pet-mock-data';
import { PetWizardComponent } from './pet-wizard.component';

interface PetCardView {
  pet: Pet;
  statusLabel: string;
  statusFg: string;
  statusBg: string;
  areaLabel: string;
  nr: string;
  gasLabel: string;
}

@Component({
  selector: 'app-pet-technician',
  standalone: true,
  imports: [PetWizardComponent],
  templateUrl: './pet-technician.component.html',
  styleUrl: './pet-technician.component.scss',
})
export class PetTechnicianComponent implements OnDestroy {
  // O <video> só existe no DOM quando cameraActive() vira true (@if no
  // template), então o ViewChild só é preenchido depois que o Angular
  // renderiza esse @if — daí o afterNextRender abaixo em vez de acessar
  // faceVideoRef logo após o .set(true). Sem isso, srcObject podia nunca
  // ser atribuído: a câmera ficava ligada (getUserMedia já resolvido) mas
  // sem imagem, e sem nova tentativa depois.
  @ViewChild('faceVideo') private readonly faceVideoRef?: ElementRef<HTMLVideoElement>;

  readonly cameraActive = signal(false);
  readonly cameraError = signal(false);
  private cameraStream: MediaStream | null = null;

  constructor(
    readonly state: PetStateService,
    private readonly injector: Injector,
  ) {
    effect(() => {
      if (this.state.screen() === 'login') {
        this.startCamera();
      } else {
        this.stopCamera();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private async startCamera(): Promise<void> {
    if (this.cameraStream) return;
    if (!navigator.mediaDevices?.getUserMedia) {
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
      this.cameraActive.set(true);
      afterNextRender(
        () => {
          const video = this.faceVideoRef?.nativeElement;
          if (!video) return;
          video.srcObject = stream;
          video.play().catch(() => undefined);
        },
        { injector: this.injector },
      );
    } catch {
      this.cameraError.set(true);
      this.cameraActive.set(false);
    }
  }

  private stopCamera(): void {
    this.cameraStream?.getTracks().forEach((track) => track.stop());
    this.cameraStream = null;
    this.cameraActive.set(false);
  }

  readonly visibleCards = computed<PetCardView[]>(() => this.state.visiblePets().map((pet) => this.toCard(pet)));

  readonly detailPet = computed<Pet | undefined>(() => this.state.pets().find((p) => p.id === this.state.detailPetId()));
  readonly detailCard = computed<PetCardView | undefined>(() => {
    const pet = this.detailPet();
    return pet ? this.toCard(pet) : undefined;
  });

  readonly emittedPet = computed<Pet | undefined>(() => this.state.pets().find((p) => p.id === this.state.emittedPetId()));

  readonly faceTitle = computed(() => {
    switch (this.state.authPhase()) {
      case 'scan':
        return 'Validando identidade…';
      case 'ok':
        return 'Identidade confirmada';
      default:
        return 'Reconhecimento facial';
    }
  });
  readonly faceText = computed(() => {
    switch (this.state.authPhase()) {
      case 'scan':
        return 'Mantenha o rosto centralizado no quadro.';
      case 'ok':
        return 'Bem-vinda, Bárbara. Carregando suas permissões…';
      default:
        return 'Posicione o rosto para acessar o PET Digital com sua credencial do SESMT.';
    }
  });
  readonly faceColor = computed(() => (this.state.authPhase() === 'ok' ? 'var(--status-ok)' : 'var(--color-bg)'));
  readonly faceScanning = computed(() => this.state.authPhase() === 'scan');
  readonly faceButtonLabel = computed(() => (this.state.authPhase() === 'idle' ? 'Iniciar reconhecimento facial' : 'Aguarde…'));

  startAuth(): void {
    this.state.startAuth();
  }

  private toCard(pet: Pet): PetCardView {
    const status = PET_STATUS[pet.alarm ? 'alarme' : pet.status];
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
