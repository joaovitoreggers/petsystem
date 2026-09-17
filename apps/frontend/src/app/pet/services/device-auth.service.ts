import { Injectable } from '@angular/core';

export interface BiometricEnrollment {
  // Guardado só para saber QUAL passkey pedir para "esquecer" depois — o
  // segredo em si (a chave privada) nunca sai do hardware do aparelho;
  // isto é só o identificador público da credencial.
  credentialId: string;
  userLabel: string;
}

const STORAGE_KEY = 'pet-digital.biometric-enrollment';

/**
 * Lembra, só para fins de interface (qual aba abrir por padrão, qual
 * credencial "esquecer"), que este aparelho já tem uma passkey cadastrada.
 * A credencial de verdade — a chave privada — nunca sai do hardware seguro
 * do aparelho; isto aqui não guarda segredo nenhum, só um identificador
 * público e um rótulo para exibir.
 */
@Injectable({ providedIn: 'root' })
export class DeviceAuthService {
  get(): BiometricEnrollment | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.credentialId !== 'string') {
        return null;
      }
      return parsed as BiometricEnrollment;
    } catch {
      return null;
    }
  }

  save(enrollment: BiometricEnrollment): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollment));
    } catch {
      // localStorage indisponível (modo privado, cota etc.) — cadastro
      // simplesmente não persiste; o app segue funcionando sem ele.
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // no-op
    }
  }
}
