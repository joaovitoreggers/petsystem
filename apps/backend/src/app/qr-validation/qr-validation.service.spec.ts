import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AccessResult } from './entities/access-event.entity';
import { IAccessEventRepository } from './repositories/access-event-repository.interface';
import { QrValidationService } from './qr-validation.service';
import { AccessAttemptStoreService } from './access-attempt-store.service';

// O QR do crachá agora é o próprio User.id (uuid) — os fixtures abaixo usam
// strings com o formato de um uuid para exercitar isso realisticamente.
const AUTHORIZED_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AUTHORIZED_ID_2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const DENIED_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const UNKNOWN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function user(overrides: Partial<User>): User {
  return {
    id: AUTHORIZED_ID,
    name: 'Test',
    email: 'test@petsystem.local',
    password: 'hash',
    role: 'funcionario',
    accessLevel: 3,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('QrValidationService', () => {
  let service: QrValidationService;
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;
  let accessEventRepository: jest.Mocked<IAccessEventRepository>;

  beforeEach(() => {
    usersService = { findById: jest.fn() };
    accessEventRepository = { record: jest.fn().mockResolvedValue(undefined) };
    const configService = { get: jest.fn().mockReturnValue('2') } as unknown as ConfigService;

    service = new QrValidationService(
      usersService as unknown as UsersService,
      accessEventRepository,
      new AccessAttemptStoreService(),
      configService,
    );
  });

  it('authorizes a user whose access level meets the required minimum', async () => {
    usersService.findById.mockResolvedValue(
      user({ id: AUTHORIZED_ID, accessLevel: 3 }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, AUTHORIZED_ID);

    expect(read.result).toBe(AccessResult.AUTHORIZED);
    expect(attempt.finalResult).toBe(AccessResult.AUTHORIZED);
    expect(accessEventRepository.record).toHaveBeenCalledWith({
      userId: AUTHORIZED_ID,
      result: AccessResult.AUTHORIZED,
      qrCodeRead: AUTHORIZED_ID,
    });
  });

  it('denies a user whose access level is insufficient', async () => {
    usersService.findById.mockResolvedValue(
      user({ id: DENIED_ID, accessLevel: 1 }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, DENIED_ID);

    expect(read.result).toBe(AccessResult.DENIED);
    expect(attempt.finalResult).toBe(AccessResult.DENIED);
  });

  it('marks the read as an invalid QR when the code matches no user', async () => {
    usersService.findById.mockResolvedValue(null);
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, UNKNOWN_ID);

    expect(read.result).toBe(AccessResult.INVALID_QR);
    expect(read.userId).toBeNull();
  });

  it('marks the read as invalid without querying the database when the scanned text is not uuid-shaped', async () => {
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, 'not-a-uuid');

    expect(read.result).toBe(AccessResult.INVALID_QR);
    expect(usersService.findById).not.toHaveBeenCalled();
  });

  it('rejects a second read of the same QR in the same attempt as a duplicate', async () => {
    usersService.findById.mockResolvedValue(
      user({ id: AUTHORIZED_ID, accessLevel: 3 }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(2);

    await service.recordRead(attempt.id, AUTHORIZED_ID);

    await expect(
      service.recordRead(attempt.id, AUTHORIZED_ID),
    ).rejects.toThrow(ConflictException);

    expect(accessEventRepository.record).toHaveBeenCalledWith({
      userId: null,
      result: AccessResult.DUPLICATE,
      qrCodeRead: AUTHORIZED_ID,
    });
    // the duplicate read must not count as a distinct read
    expect(attempt.reads).toHaveLength(1);
  });

  it('requires one distinct read per detected person before completing the attempt', async () => {
    usersService.findById
      .mockResolvedValueOnce(user({ id: AUTHORIZED_ID, accessLevel: 3 }))
      .mockResolvedValueOnce(user({ id: AUTHORIZED_ID_2, accessLevel: 3 }));

    const attempt = service.startAttempt();
    attempt.startDetection(2);

    await service.recordRead(attempt.id, AUTHORIZED_ID);
    expect(attempt.status).toBe('AWAITING_READS');
    expect(attempt.finalResult).toBeNull();

    await service.recordRead(attempt.id, AUTHORIZED_ID_2);
    expect(attempt.status).toBe('COMPLETE');
    expect(attempt.finalResult).toBe(AccessResult.AUTHORIZED);
  });

  it('completes the attempt as DENIED if any of the distinct reads is denied', async () => {
    usersService.findById
      .mockResolvedValueOnce(user({ id: AUTHORIZED_ID, accessLevel: 3 }))
      .mockResolvedValueOnce(user({ id: DENIED_ID, accessLevel: 1 }));

    const attempt = service.startAttempt();
    attempt.startDetection(2);

    await service.recordRead(attempt.id, AUTHORIZED_ID);
    await service.recordRead(attempt.id, DENIED_ID);

    expect(attempt.finalResult).toBe(AccessResult.DENIED);
  });
});
