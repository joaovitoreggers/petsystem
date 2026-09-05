import { ConflictException } from '@nestjs/common';
import { AccessResult } from './entities/access-event.entity';
import { AccessAttempt } from './access-attempt';
import { AttemptStatus } from './access-attempt.types';

describe('AccessAttempt (State pattern)', () => {
  it('starts awaiting detection and does not accept reads directly', () => {
    const attempt = new AccessAttempt(60_000);
    expect(attempt.status).toBe(AttemptStatus.AWAITING_DETECTION);
    expect(() =>
      attempt.recordRead({ qrCode: 'x', employeeId: null, result: AccessResult.AUTHORIZED }),
    ).toThrow(ConflictException);
  });

  it('moves to awaiting reads once detection reports the person count', () => {
    const attempt = new AccessAttempt(60_000);
    attempt.startDetection(2);
    expect(attempt.status).toBe(AttemptStatus.AWAITING_READS);
    expect(attempt.expectedCount).toBe(2);
  });

  it('does not allow starting detection again once already started', () => {
    const attempt = new AccessAttempt(60_000);
    attempt.startDetection(1);
    expect(() => attempt.startDetection(1)).toThrow(ConflictException);
  });

  it('completes automatically once the expected number of distinct reads is reached', () => {
    const attempt = new AccessAttempt(60_000);
    attempt.startDetection(2);
    attempt.recordRead({ qrCode: 'A', employeeId: 'employee-a', result: AccessResult.AUTHORIZED });
    expect(attempt.status).toBe(AttemptStatus.AWAITING_READS);
    attempt.recordRead({ qrCode: 'B', employeeId: 'employee-b', result: AccessResult.AUTHORIZED });
    expect(attempt.status).toBe(AttemptStatus.COMPLETE);
  });

  it('does not accept new reads once complete', () => {
    const attempt = new AccessAttempt(60_000);
    attempt.startDetection(1);
    attempt.recordRead({ qrCode: 'A', employeeId: 'employee-a', result: AccessResult.AUTHORIZED });
    expect(() =>
      attempt.recordRead({ qrCode: 'B', employeeId: 'employee-b', result: AccessResult.AUTHORIZED }),
    ).toThrow(ConflictException);
  });

  it('expires after the time limit and starts rejecting new reads', () => {
    const attempt = new AccessAttempt(-1);
    attempt.startDetection(1);
    expect(attempt.expired).toBe(true);
  });
});
