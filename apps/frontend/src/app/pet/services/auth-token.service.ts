import { Injectable } from '@angular/core';

/**
 * Guarda o JWT da sessão fora de PetStateService de propósito: o interceptor
 * HTTP precisa ler esse token em toda chamada, inclusive nas que
 * PetStateService dispara do próprio construtor (loadFromBackend()) — se o
 * interceptor injetasse PetStateService diretamente, essa primeira chamada
 * criaria uma dependência circular (NG0200) porque o serviço ainda estaria
 * sendo construído. Este serviço não depende de nada, então quebra o ciclo.
 */
@Injectable({ providedIn: 'root' })
export class AuthTokenService {
  private token: string | null = null;

  setToken(token: string | null): void {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }
}
