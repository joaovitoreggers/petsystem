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
 * tela apenas passou a usá-lo.
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
}
