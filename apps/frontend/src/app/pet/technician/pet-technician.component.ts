import { Component, computed } from '@angular/core';
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
export class PetTechnicianComponent {
  constructor(readonly state: PetStateService) {}

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
