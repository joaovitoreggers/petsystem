import { ConflictException } from '@nestjs/common';
import { AttemptStatus, RecordedRead } from '../access-attempt.types';
import type { AccessAttempt } from '../access-attempt';

/**
 * State pattern: cada estado concreto sabe quais transições são válidas,
 * substituindo um emaranhado de flags booleanas (isWaiting, isDone, isExpired, ...).
 */
export abstract class AttemptState {
  abstract readonly status: AttemptStatus;

  startDetection(_context: AccessAttempt, _personCount: number): void {
    throw new ConflictException(
      `Cannot start detection while in status ${this.status}`,
    );
  }

  recordRead(_context: AccessAttempt, _read: RecordedRead): void {
    throw new ConflictException(
      `Cannot record a read while in status ${this.status}`,
    );
  }
}

export class AwaitingDetectionState extends AttemptState {
  readonly status = AttemptStatus.AWAITING_DETECTION;

  override startDetection(context: AccessAttempt, personCount: number): void {
    if (personCount < 1) {
      throw new ConflictException('Detected person count must be at least 1');
    }
    context.setExpectedCount(personCount);
    context.transitionTo(new AwaitingReadsState());
  }
}

export class AwaitingReadsState extends AttemptState {
  readonly status = AttemptStatus.AWAITING_READS;

  override recordRead(context: AccessAttempt, read: RecordedRead): void {
    context.addRead(read);
    if (context.reads.length >= context.expectedCount) {
      context.transitionTo(new CompleteState());
    }
  }
}

export class CompleteState extends AttemptState {
  readonly status = AttemptStatus.COMPLETE;
}

export class ExpiredState extends AttemptState {
  readonly status = AttemptStatus.EXPIRED;
}
