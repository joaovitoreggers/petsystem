import { Injectable, NotFoundException } from '@nestjs/common';
import { ExpiredState } from './state/attempt.state';
import { AccessAttempt } from './access-attempt';

const DEFAULT_TTL_MS = 2 * 60 * 1000;

/**
 * Store em memória para instâncias de AccessAttempt em andamento. Um
 * deployment real moveria isso para o Redis; para esta prova de conceito,
 * um Map em processo único é suficiente, já que o AccessEvent (o log de
 * auditoria durável) é o que de fato persiste no banco.
 */
@Injectable()
export class AccessAttemptStoreService {
  private readonly attempts = new Map<string, AccessAttempt>();

  create(ttlMs: number = DEFAULT_TTL_MS): AccessAttempt {
    const attempt = new AccessAttempt(ttlMs);
    this.attempts.set(attempt.id, attempt);
    return attempt;
  }

  get(id: string): AccessAttempt {
    const attempt = this.attempts.get(id);
    if (!attempt) {
      throw new NotFoundException('Access attempt not found');
    }
    attempt.expireIfNeeded(new ExpiredState());
    return attempt;
  }
}
