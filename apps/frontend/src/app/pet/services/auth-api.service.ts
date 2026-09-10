import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
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
  // não fazem parte do JWT (ver AuthService.login no back-end).
  user: AuthenticatedUser & { companyGroupName: string | null; branchName: string | null };
}

/**
 * Login por e-mail e senha contra o `AuthModule` do back-end
 * (`POST /api/auth/login`, guardado pelo `LocalAuthGuard`): devolve o JWT e
 * o usuário autenticado. É o mesmo contrato que já existia no servidor — a
 * tela apenas passou a usá-lo. `device-token`/`device-login` sustentam o
 * reconhecimento facial: emitir um token de aparelho exige sessão real já
 * em mãos; device-login troca esse token (nunca a senha) por uma sessão
 * nova depois que o rosto foi reconhecido localmente (ver
 * FaceRecognitionService/DeviceAuthService).
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

  issueDeviceToken(): Observable<{ deviceToken: string }> {
    return this.http.post<{ deviceToken: string }>(`${this.baseUrl}/device-token`, {});
  }

  deviceLogin(deviceToken: string): Observable<LoginResult> {
    return this.http.post<LoginResult>(`${this.baseUrl}/device-login`, { deviceToken });
  }

  revokeDeviceToken(deviceToken: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/device-token`, { body: { deviceToken } });
  }
}
