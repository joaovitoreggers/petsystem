import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AccessResult } from './entities/access-event.entity';
import { IAccessEventRepository } from './repositories/access-event-repository.interface';
import { QrValidationService } from './qr-validation.service';
import { AccessAttemptStoreService } from './access-attempt-store.service';

function user(overrides: Partial<User>): User {
  return {
    id: 1,
    name: 'Test',
    email: 'test@petsystem.local',
    password: 'hash',
    role: 'funcionario',
    accessLevel: 3,
    qrCode: 'QR-1',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('QrValidationService', () => {
  let service: QrValidationService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByQrCode'>>;
  let accessEventRepository: jest.Mocked<IAccessEventRepository>;

  beforeEach(() => {
    usersService = { findByQrCode: jest.fn() };
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
    usersService.findByQrCode.mockResolvedValue(
      user({ accessLevel: 3, qrCode: 'QR-AUTHORIZED' }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, 'QR-AUTHORIZED');

    expect(read.result).toBe(AccessResult.AUTHORIZED);
    expect(attempt.finalResult).toBe(AccessResult.AUTHORIZED);
    expect(accessEventRepository.record).toHaveBeenCalledWith({
      userId: 1,
      result: AccessResult.AUTHORIZED,
      qrCodeRead: 'QR-AUTHORIZED',
    });
  });

  it('denies a user whose access level is insufficient', async () => {
    usersService.findByQrCode.mockResolvedValue(
      user({ id: 2, accessLevel: 1, qrCode: 'QR-DENIED' }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, 'QR-DENIED');

    expect(read.result).toBe(AccessResult.DENIED);
    expect(attempt.finalResult).toBe(AccessResult.DENIED);
  });

  it('marks the read as an invalid QR when the code matches no user', async () => {
    usersService.findByQrCode.mockResolvedValue(null);
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, 'QR-UNKNOWN');

    expect(read.result).toBe(AccessResult.INVALID_QR);
    expect(read.userId).toBeNull();
  });

  it('rejects a second read of the same QR in the same attempt as a duplicate', async () => {
    usersService.findByQrCode.mockResolvedValue(
      user({ accessLevel: 3, qrCode: 'QR-REPEATED' }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(2);

    await service.recordRead(attempt.id, 'QR-REPEATED');

    await expect(
      service.recordRead(attempt.id, 'QR-REPEATED'),
    ).rejects.toThrow(ConflictException);

    expect(accessEventRepository.record).toHaveBeenCalledWith({
      userId: null,
      result: AccessResult.DUPLICATE,
      qrCodeRead: 'QR-REPEATED',
    });
    // the duplicate read must not count as a distinct read
    expect(attempt.reads).toHaveLength(1);
  });

  it('requires one distinct read per detected person before completing the attempt', async () => {
    usersService.findByQrCode
      .mockResolvedValueOnce(user({ id: 10, accessLevel: 3, qrCode: 'QR-A' }))
      .mockResolvedValueOnce(user({ id: 20, accessLevel: 3, qrCode: 'QR-B' }));

    const attempt = service.startAttempt();
    attempt.startDetection(2);

    await service.recordRead(attempt.id, 'QR-A');
    expect(attempt.status).toBe('AWAITING_READS');
    expect(attempt.finalResult).toBeNull();

    await service.recordRead(attempt.id, 'QR-B');
    expect(attempt.status).toBe('COMPLETE');
    expect(attempt.finalResult).toBe(AccessResult.AUTHORIZED);
  });

  it('completes the attempt as DENIED if any of the distinct reads is denied', async () => {
    usersService.findByQrCode
      .mockResolvedValueOnce(user({ id: 10, accessLevel: 3, qrCode: 'QR-A' }))
      .mockResolvedValueOnce(user({ id: 20, accessLevel: 1, qrCode: 'QR-B' }));

    const attempt = service.startAttempt();
    attempt.startDetection(2);

    await service.recordRead(attempt.id, 'QR-A');
    await service.recordRead(attempt.id, 'QR-B');

    expect(attempt.finalResult).toBe(AccessResult.DENIED);
  });
});
