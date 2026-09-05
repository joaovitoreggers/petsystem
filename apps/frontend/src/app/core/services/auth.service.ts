import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
}

interface LoginResponse {
  accessToken: string;
  user: AuthenticatedUser;
}

const TOKEN_KEY = 'petsystem.accessToken';
const USER_KEY = 'petsystem.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSignal = signal<string | null>(
    localStorage.getItem(TOKEN_KEY),
  );
  private readonly userSignal = signal<AuthenticatedUser | null>(
    this.readStoredUser(),
  );

  readonly user = this.userSignal.asReadonly();
  readonly authenticated = computed(() => this.tokenSignal() !== null);

  constructor(private readonly http: HttpClient) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password })
      .pipe(
        tap((response) => {
          this.tokenSignal.set(response.accessToken);
          this.userSignal.set(response.user);
          localStorage.setItem(TOKEN_KEY, response.accessToken);
          localStorage.setItem(USER_KEY, JSON.stringify(response.user));
        }),
      );
  }

  logout(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getToken(): string | null {
    return this.tokenSignal();
  }

  private readStoredUser(): AuthenticatedUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthenticatedUser) : null;
  }
}
