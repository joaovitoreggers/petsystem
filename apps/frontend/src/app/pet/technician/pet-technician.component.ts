import { Component, computed, signal } from '@angular/core';
import { platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { PetStateService } from '../pet-state.service';
import {
  ChecklistAnswer,
  GAS_LIMITS,
  GasKey,
  PET_TEAM_ROLE_LABEL,
  petStatusView,
  Pet,
  buildChecklistGroups,
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
export class PetTechnicianComponent {
  // Se este aparelho tem um autenticador de plataforma disponível (Face
  // ID/Touch ID/Windows Hello/impressão digital) — sem isso, a aba de
  // biometria só ia mostrar um prompt que o navegador nunca conseguiria
  // atender. `platformAuthenticatorIsAvailable()` é assíncrono; começa
  // otimista (true) para não piscar a UI antes da resposta chegar.
  readonly biometricSupported = signal(true);

  constructor(readonly state: PetStateService) {
    platformAuthenticatorIsAvailable()
      .then((available) => this.biometricSupported.set(available))
      .catch(() => this.biometricSupported.set(false));
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

  readonly teamRoleLabel = PET_TEAM_ROLE_LABEL;
  readonly checklistAnswerLabel: Record<ChecklistAnswer, string> = {
    sim: 'SIM',
    nao: 'NÃO',
    na: 'NA',
  };

  // Checklist respondido na etapa "Checklist e foto" — só os itens com
  // resposta salva aparecem. Mesma lógica do painel de gestão (ver
  // PetManagerComponent.detailChecklistGroups).
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

  readonly detailFireWatchRounds = computed(
    () => this.detailPet()?.fireWatchRounds?.filter((r) => r.hora && r.nome) ?? [],
  );

  readonly emittedPet = computed<Pet | undefined>(() =>
    this.state.pets().find((p) => p.id === this.state.emittedPetId()),
  );

  readonly biometricTitle = computed(() => {
    switch (this.state.authPhase()) {
      case 'scan':
        return 'Aguardando confirmação…';
      case 'ok':
        return 'Identidade confirmada';
      default:
        if (!this.biometricSupported()) return 'Biometria indisponível neste aparelho';
        return this.state.hasBiometricEnrollment()
          ? 'Biometria do aparelho'
          : 'Nenhuma biometria cadastrada';
    }
  });
  readonly biometricText = computed(() => {
    switch (this.state.authPhase()) {
      case 'scan':
        return 'Siga a instrução que apareceu no seu aparelho (rosto, digital ou PIN).';
      case 'ok':
        return 'Identidade confirmada. Carregando suas permissões…';
      default:
        if (this.state.biometricAuthError()) return this.state.biometricAuthError() as string;
        if (!this.biometricSupported()) {
          return 'Este aparelho não oferece Face ID, Touch ID, Windows Hello ou impressão digital. Entre por e-mail e senha.';
        }
        return this.state.hasBiometricEnrollment()
          ? 'Toque no botão abaixo e confirme com a biometria deste aparelho.'
          : 'Entre por e-mail e senha uma vez para habilitar a biometria neste aparelho.';
    }
  });
  readonly biometricScanning = computed(() => this.state.authPhase() === 'scan');
  readonly biometricButtonLabel = computed(() => {
    if (this.state.authPhase() !== 'idle') return 'Aguarde…';
    return this.state.hasBiometricEnrollment()
      ? 'Usar biometria do aparelho'
      : 'Entre por e-mail e senha';
  });
  readonly biometricButtonDisabled = computed(
    () =>
      this.state.authPhase() !== 'idle' ||
      !this.state.hasBiometricEnrollment() ||
      !this.biometricSupported(),
  );

  startAuth(): void {
    if (!this.state.hasBiometricEnrollment()) {
      this.state.setAuthMethod('senha');
      return;
    }
    void this.state.startBiometricLogin();
  }

  // ── Cadastro de biometria (depois de um login real) ──────────────────
  confirmEnroll(): void {
    void this.state.confirmBiometricEnrollment();
  }

  skipEnroll(): void {
    this.state.skipBiometricEnrollment();
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
