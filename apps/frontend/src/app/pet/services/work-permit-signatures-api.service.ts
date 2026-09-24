import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { environment } from '../../../environments/environment';

export type SignaturePetRole = 'emitente' | 'executante' | 'encerrante';
export type SignatureLifecycleEvent = 'abertura' | 'encerramento';
export type SignatureMethod = 'biometria' | 'cracha_pin' | 'sms_otp';
export type OtpChannel = 'sms' | 'whatsapp';
export type OtpDelivery = 'sent' | 'failed' | 'not_configured';

export interface SignatureGeolocation {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface WorkPermitSignature {
  id: string;
  workPermitId: string | null;
  draftId: string | null;
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  signerName: string;
  method: SignatureMethod;
  geolocation: SignatureGeolocation | null;
  signedAt: string;
}

interface SignatureRequestBase {
  petRole: SignaturePetRole;
  lifecycleEvent: SignatureLifecycleEvent;
  draftId?: string;
  workPermitId?: string;
  contentSnapshot: Record<string, unknown>;
}

export interface BiometricSignatureOptionsPayload extends SignatureRequestBase {}

export interface VerifyBiometricSignaturePayload {
  challengeId: string;
  response: AuthenticationResponseJSON;
  geolocation?: SignatureGeolocation;
}

export interface VerifyCrachaPinSignaturePayload extends SignatureRequestBase {
  registration: string;
  pin: string;
  geolocation?: SignatureGeolocation;
}

export interface SendOtpSignaturePayload extends SignatureRequestBase {
  registration?: string;
  channel: OtpChannel;
}

export interface VerifyOtpSignaturePayload {
  otpId: string;
  code: string;
  geolocation?: SignatureGeolocation;
}

/**
 * Assinatura eletrônica de PET (abertura/encerramento) contra
 * `/api/work-permit-signatures` — os 3 métodos (biometria, crachá+PIN,
 * SMS/WhatsApp), usados pelo `PetSignaturePanelComponent`. Todas as rotas
 * exigem o JWT da sessão (anexado pelo authInterceptor) — quem assina por
 * crachá+PIN ou OTP não loga separadamente, se identifica no mesmo
 * aparelho de quem já está logado.
 */
@Injectable({ providedIn: 'root' })
export class WorkPermitSignaturesApiService {
  private readonly baseUrl = `${environment.apiUrl}/work-permit-signatures`;

  constructor(private readonly http: HttpClient) {}

  requestBiometricOptions(
    payload: BiometricSignatureOptionsPayload,
  ): Observable<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }> {
    return this.http.post<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }>(
      `${this.baseUrl}/biometria/options`,
      payload,
    );
  }

  verifyBiometric(payload: VerifyBiometricSignaturePayload): Observable<WorkPermitSignature> {
    return this.http.post<WorkPermitSignature>(`${this.baseUrl}/biometria/verify`, payload);
  }

  verifyCrachaPin(payload: VerifyCrachaPinSignaturePayload): Observable<WorkPermitSignature> {
    return this.http.post<WorkPermitSignature>(`${this.baseUrl}/cracha-pin/verify`, payload);
  }

  sendOtp(
    payload: SendOtpSignaturePayload,
  ): Observable<{ otpId: string; delivery: OtpDelivery; devCode?: string }> {
    return this.http.post<{ otpId: string; delivery: OtpDelivery; devCode?: string }>(
      `${this.baseUrl}/otp/send`,
      payload,
    );
  }

  verifyOtp(payload: VerifyOtpSignaturePayload): Observable<WorkPermitSignature> {
    return this.http.post<WorkPermitSignature>(`${this.baseUrl}/otp/verify`, payload);
  }

  findByDraftId(draftId: string): Observable<WorkPermitSignature[]> {
    return this.http.get<WorkPermitSignature[]>(`${this.baseUrl}/draft/${draftId}`);
  }
}
