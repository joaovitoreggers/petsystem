import { randomUUID } from 'crypto';
import { AccessResult } from './entities/access-event.entity';
import { AttemptState, AwaitingDetectionState } from './state/attempt.state';
import { AttemptStatus, RecordedRead } from './access-attempt.types';

/**
 * State pattern context: mantém o AttemptState atual e os dados sobre os
 * quais ele opera, delegando cada transição a esse objeto de estado.
 */
export class AccessAttempt {
  readonly id: string = randomUUID();
  readonly createdAt: Date = new Date();
  readonly expiresAt: Date;
  readonly reads: RecordedRead[] = [];
  expectedCount = 0;
  private state: AttemptState = new AwaitingDetectionState();

  constructor(ttlMs: number) {
    this.expiresAt = new Date(this.createdAt.getTime() + ttlMs);
  }

  get status(): AttemptStatus {
    return this.state.status;
  }

  get expired(): boolean {
    return (
      this.state.status !== AttemptStatus.COMPLETE &&
      Date.now() > this.expiresAt.getTime()
    );
  }

  startDetection(personCount: number): void {
    this.state.startDetection(this, personCount);
  }

  recordRead(read: RecordedRead): void {
    this.state.recordRead(this, read);
  }

  hasRead(qrCode: string): boolean {
    return this.reads.some((read) => read.qrCode === qrCode);
  }

  /** @internal usado apenas pelas implementações de AttemptState */
  setExpectedCount(count: number): void {
    this.expectedCount = count;
  }

  /** @internal usado apenas pelas implementações de AttemptState */
  addRead(read: RecordedRead): void {
    this.reads.push(read);
  }

  /** @internal usado apenas pelas implementações de AttemptState */
  transitionTo(newState: AttemptState): void {
    this.state = newState;
  }

  expireIfNeeded(expiredState: AttemptState): void {
    if (this.expired) {
      this.state = expiredState;
    }
  }

  /** Só faz sentido quando status === COMPLETE: o acesso só é concedido se todas as leituras distintas foram autorizadas. */
  get finalResult(): AccessResult | null {
    if (this.status !== AttemptStatus.COMPLETE) {
      return null;
    }
    const allAuthorized = this.reads.every(
      (read) => read.result === AccessResult.AUTHORIZED,
    );
    return allAuthorized ? AccessResult.AUTHORIZED : AccessResult.DENIED;
  }
}
