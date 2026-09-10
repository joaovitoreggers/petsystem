import { Injectable } from '@angular/core';

export interface FaceEnrollment {
  // Vetor de 128 números (Float32Array serializado) — nunca uma imagem.
  descriptor: number[];
  // Token de "lembrar este aparelho" (id.segredo) — nunca a senha; ver
  // AuthService.issueDeviceToken no back-end. Só ele + o rosto reconhecido
  // localmente reabrem uma sessão.
  deviceToken: string;
  userLabel: string;
}

const STORAGE_KEY = 'pet-digital.face-enrollment';

/**
 * Guarda o cadastro de reconhecimento facial deste aparelho — aparelho
 * pessoal, um cadastro só por vez (ver o front-end: cadastrar de novo
 * substitui o anterior). Fica só no localStorage deste navegador; nunca é
 * enviado ao back-end (só o deviceToken é, pra trocar por uma sessão).
 */
@Injectable({ providedIn: 'root' })
export class DeviceAuthService {
  get(): FaceEnrollment | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.descriptor) || typeof parsed?.deviceToken !== 'string') {
        return null;
      }
      return parsed as FaceEnrollment;
    } catch {
      return null;
    }
  }

  save(enrollment: FaceEnrollment): void {
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
