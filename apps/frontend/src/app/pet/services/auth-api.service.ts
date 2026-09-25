import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from '@simplewebauthn/browser';
import { environment } from '../../../environments/environment';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  companyGroupId: string | null;
  branchId: string | null;
}

export interface LoginResult {
  accessToken: string;
  // Nomes exibíveis, resolvidos pelo back-end só na resposta de login —
  // não fazem parte do JWT (ver AuthService.login no back-end). `name` é o
  // nome exibido como emitente na assinatura eletrônica de PET.
  user: AuthenticatedUser & { name: string; companyGroupName: string | null; branchName: string | null };
}

/**
 * Login por e-mail e senha contra o `AuthModule` do back-end
 * (`POST /api/auth/login`, guardado pelo `LocalAuthGuard`): devolve o JWT e
 * o usuário autenticado. As rotas `webauthn/*` sustentam a biometria nativa
 * do aparelho (Face ID/Touch ID/Windows Hello/impressão digital): cadastrar
 * uma passkey exige sessão real já em mãos; o login por biometria verifica
 * a assinatura no servidor e devolve uma sessão nova, sem nunca a chave
 * privada sair do hardware seguro do aparelho (ver PetStateService).
 */
@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.baseUrl}/login`, {
      email,
      password,
    });
  }

  getBiometricRegistrationOptions(): Observable<PublicKeyCredentialCreationOptionsJSON> {
    return this.http.post<PublicKeyCredentialCreationOptionsJSON>(
      `${this.baseUrl}/webauthn/register/options`,
      {},
    );
  }

  verifyBiometricRegistration(response: RegistrationResponseJSON): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/webauthn/register/verify`, response);
  }

  getBiometricLoginOptions(): Observable<{
    options: PublicKeyCredentialRequestOptionsJSON;
    challengeId: string;
  }> {
    return this.http.post<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }>(
      `${this.baseUrl}/webauthn/login/options`,
      {},
    );
  }

  verifyBiometricLogin(
    challengeId: string,
    response: AuthenticationResponseJSON,
  ): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.baseUrl}/webauthn/login/verify`, {
      challengeId,
      response,
    });
  }

  forgetBiometricCredential(credentialId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/webauthn/credentials/${credentialId}`);
  }
}
