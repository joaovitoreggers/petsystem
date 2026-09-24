import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, computed, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { startAuthentication, WebAuthnError } from '@simplewebauthn/browser';
import {
  OtpChannel,
  OtpDelivery,
  SignatureGeolocation,
  SignatureLifecycleEvent,
  SignatureMethod,
  SignaturePetRole,
  WorkPermitSignature,
  WorkPermitSignaturesApiService,
} from '../services/work-permit-signatures-api.service';
import { IconComponent } from '../../shared/icon.component';

interface MethodOption {
  id: SignatureMethod;
  label: string;
  icon: 'fingerprint' | 'qr' | 'document';
}

const METHOD_OPTIONS: Record<SignatureMethod, MethodOption> = {
  biometria: { id: 'biometria', label: 'Biometria', icon: 'fingerprint' },
  cracha_pin: { id: 'cracha_pin', label: 'Crachá + PIN', icon: 'qr' },
  sms_otp: { id: 'sms_otp', label: 'Código SMS/WhatsApp', icon: 'document' },
};

/**
 * Assinatura eletrônica avançada (Lei 14.063/2020) de um papel específico
 * (emitente/executante/encerrante) num evento do ciclo de vida da PET —
 * biometria, crachá+PIN ou código SMS/WhatsApp, escolhido livremente por
 * quem assina. Reaproveitado tanto no passo "sig" do assistente (emitente +
 * executante) quanto no diálogo de encerramento.
 *
 * Sem suporte offline de propósito (fica para um app nativo futuro): sem
 * conexão, mostra um bloqueio claro em vez de fingir sucesso local.
 */
@Component({
  selector: 'app-pet-signature-panel',
  standalone: true,
  imports: [IconComponent, DatePipe],
  templateUrl: './pet-signature-panel.component.html',
  styleUrl: './pet-signature-panel.component.scss',
})
export class PetSignaturePanelComponent implements OnInit, OnDestroy {
  @Input({ required: true }) signerLabel!: string;
  @Input({ required: true }) petRole!: SignaturePetRole;
  @Input({ required: true }) lifecycleEvent!: SignatureLifecycleEvent;
  @Input() draftId?: string;
  @Input() workPermitId?: string;
  @Input({ required: true }) contentSnapshot!: Record<string, unknown>;
  // Só necessário para papéis de membro da escala (executante/encerrante
  // quando não é o técnico logado) — o emitente nunca precisa, se
  // identifica pela própria sessão.
  @Input() registration?: string;

  @Output() readonly signed = new EventEmitter<WorkPermitSignature>();

  constructor(private readonly signaturesApi: WorkPermitSignaturesApiService) {}

  readonly online = signal(navigator.onLine);
  private readonly handleOnline = () => this.online.set(true);
  private readonly handleOffline = () => this.online.set(false);

  readonly completedSignature = signal<WorkPermitSignature | null>(null);
  readonly activeMethod = signal<SignatureMethod | null>(null);
  readonly signing = signal(false);
  readonly error = signal<string | null>(null);

  // 'emitente' e 'encerrante' são sempre quem está logado (mesma sessão que
  // abre/fecha a PET) — biometria e SMS/WhatsApp fazem sentido, crachá não
  // (não têm crachá, têm sessão). Só 'executante' é um membro da escala sem
  // sessão própria, daí crachá+PIN em vez de biometria.
  readonly availableMethods = computed<MethodOption[]>(() => {
    const methods: SignatureMethod[] =
      this.petRole === 'executante' ? ['cracha_pin', 'sms_otp'] : ['biometria', 'sms_otp'];
    return methods.map((m) => METHOD_OPTIONS[m]);
  });

  // Crachá + PIN
  readonly pinValue = signal('');
  readonly pinDisabled = computed(() => !/^\d{4,6}$/.test(this.pinValue()) || this.signing());

  // SMS/WhatsApp
  readonly otpChannel = signal<OtpChannel>('sms');
  readonly otpId = signal<string | null>(null);
  readonly otpDevCode = signal<string | null>(null);
  readonly otpCode = signal('');
  readonly otpDisabled = computed(() => !/^\d{4,8}$/.test(this.otpCode()) || this.signing());

  private geolocation: SignatureGeolocation | null = null;

  ngOnInit(): void {
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
    this.captureGeolocation();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  // Best-effort: nunca bloqueia nem insiste — se negada/indisponível, a
  // assinatura segue sem coordenada.
  private captureGeolocation(): void {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.geolocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
      },
      () => {
        // negada, indisponível ou expirou — segue sem coordenada
      },
      { timeout: 8000, maximumAge: 60_000 },
    );
  }

  selectMethod(method: SignatureMethod): void {
    this.error.set(null);
    this.activeMethod.set(method);
    if (method === 'biometria') {
      void this.signWithBiometria();
    }
  }

  cancelMethod(): void {
    this.activeMethod.set(null);
    this.error.set(null);
    this.pinValue.set('');
    this.otpId.set(null);
    this.otpDevCode.set(null);
    this.otpCode.set('');
  }

  private requestBase() {
    return {
      petRole: this.petRole,
      lifecycleEvent: this.lifecycleEvent,
      draftId: this.draftId,
      workPermitId: this.workPermitId,
      contentSnapshot: this.contentSnapshot,
    };
  }

  async signWithBiometria(): Promise<void> {
    this.signing.set(true);
    this.error.set(null);
    try {
      const { options, challengeId } = await firstValueFrom(
        this.signaturesApi.requestBiometricOptions(this.requestBase()),
      );
      const response = await startAuthentication({ optionsJSON: options });
      const signature = await firstValueFrom(
        this.signaturesApi.verifyBiometric({
          challengeId,
          response,
          geolocation: this.geolocation ?? undefined,
        }),
      );
      this.completeWith(signature);
    } catch (err) {
      this.error.set(biometricSignatureErrorMessage(err));
      this.activeMethod.set(null);
    } finally {
      this.signing.set(false);
    }
  }

  async confirmPin(): Promise<void> {
    if (this.pinDisabled()) return;
    if (!this.registration) {
      this.error.set('Não foi possível identificar quem está assinando — volte e leia o crachá de novo.');
      return;
    }
    this.signing.set(true);
    this.error.set(null);
    try {
      const signature = await firstValueFrom(
        this.signaturesApi.verifyCrachaPin({
          ...this.requestBase(),
          registration: this.registration,
          pin: this.pinValue(),
          geolocation: this.geolocation ?? undefined,
        }),
      );
      this.completeWith(signature);
    } catch (err) {
      this.error.set(signatureErrorMessage(err));
      this.pinValue.set('');
    } finally {
      this.signing.set(false);
    }
  }

  async sendOtp(): Promise<void> {
    this.signing.set(true);
    this.error.set(null);
    this.otpDevCode.set(null);
    try {
      const result = await firstValueFrom(
        this.signaturesApi.sendOtp({
          ...this.requestBase(),
          registration: this.petRole === 'executante' ? this.registration : undefined,
          channel: this.otpChannel(),
        }),
      );
      this.otpId.set(result.otpId);
      if (result.devCode) {
        this.otpDevCode.set(result.devCode);
      } else if (result.delivery === 'failed') {
        this.error.set('Não foi possível enviar o código agora. Tente de novo.');
      }
    } catch (err) {
      this.error.set(signatureErrorMessage(err));
    } finally {
      this.signing.set(false);
    }
  }

  async confirmOtp(): Promise<void> {
    const otpId = this.otpId();
    if (this.otpDisabled() || !otpId) return;
    this.signing.set(true);
    this.error.set(null);
    try {
      const signature = await firstValueFrom(
        this.signaturesApi.verifyOtp({
          otpId,
          code: this.otpCode(),
          geolocation: this.geolocation ?? undefined,
        }),
      );
      this.completeWith(signature);
    } catch (err) {
      this.error.set(signatureErrorMessage(err));
      this.otpCode.set('');
    } finally {
      this.signing.set(false);
    }
  }

  private completeWith(signature: WorkPermitSignature): void {
    this.completedSignature.set(signature);
    this.activeMethod.set(null);
    this.signed.emit(signature);
  }

  methodLabel(method: SignatureMethod): string {
    return METHOD_OPTIONS[method].label;
  }

  deliveryLabel(delivery: OtpDelivery): string {
    if (delivery === 'not_configured') return 'modo de teste — Twilio não configurado';
    if (delivery === 'failed') return 'falha no envio';
    return 'enviado';
  }
}

/**
 * Por que a assinatura por biometria não confirmou, na linguagem de quem
 * está em campo — mesmo raciocínio de biometricErrorMessage() em
 * PetStateService, mas para uma cerimônia de assinatura, não de login.
 */
function biometricSignatureErrorMessage(err: unknown): string {
  if (err instanceof WebAuthnError) {
    if (err.code === 'ERROR_CEREMONY_ABORTED') return 'Assinatura cancelada.';
    return 'Não foi possível confirmar a biometria neste aparelho.';
  }
  return signatureErrorMessage(err);
}

function signatureErrorMessage(err: unknown): string {
  const status = (err as { status?: number })?.status;
  if (status === 0 || status === undefined) {
    return 'Sem conexão com o servidor — não é possível assinar agora. Tente de novo quando a conexão voltar.';
  }
  if (status >= 502) {
    return 'Servidor indisponível agora. Tente de novo em instantes.';
  }
  if (status === 401) {
    if (typeof (err as { error?: { message?: unknown } })?.error?.message === 'string') {
      return (err as { error: { message: string } }).error.message;
    }
    return 'Não foi possível confirmar — verifique o código ou PIN e tente de novo.';
  }
  const body = (err as { error?: { message?: unknown } })?.error;
  if (body && typeof body.message === 'string' && body.message.trim()) {
    return body.message;
  }
  return 'Não foi possível assinar agora. Tente novamente.';
}
