import { ConflictException } from '@nestjs/common';
import { EmployeesService } from '../employees/employees.service';
import { Employee } from '../employees/entities/employee.entity';
import { AccessResult } from './entities/access-event.entity';
import { IAccessEventRepository } from './repositories/access-event-repository.interface';
import { QrValidationService } from './qr-validation.service';
import { AccessAttemptStoreService } from './access-attempt-store.service';

// O QR do crachá é o próprio Employee.id (uuid) — os fixtures abaixo usam
// strings com o formato de um uuid para exercitar isso realisticamente.
const AUTHORIZED_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const AUTHORIZED_ID_2 = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const DENIED_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const UNKNOWN_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

function employee(overrides: Partial<Employee>): Employee {
  return {
    id: AUTHORIZED_ID,
    name: 'Test',
    role: 'tecnico',
    canAccessRiskAreas: true,
    canPerformCorrectiveService: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('QrValidationService', () => {
  let service: QrValidationService;
  let employeesService: jest.Mocked<Pick<EmployeesService, 'findById'>>;
  let accessEventRepository: jest.Mocked<IAccessEventRepository>;

  beforeEach(() => {
    employeesService = { findById: jest.fn() };
    accessEventRepository = { record: jest.fn().mockResolvedValue(undefined) };

    service = new QrValidationService(
      employeesService as unknown as EmployeesService,
      accessEventRepository,
      new AccessAttemptStoreService(),
    );
  });

  it('authorizes an employee with canAccessRiskAreas', async () => {
    employeesService.findById.mockResolvedValue(
      employee({ id: AUTHORIZED_ID, canAccessRiskAreas: true }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, AUTHORIZED_ID);

    expect(read.result).toBe(AccessResult.AUTHORIZED);
    expect(attempt.finalResult).toBe(AccessResult.AUTHORIZED);
    expect(accessEventRepository.record).toHaveBeenCalledWith({
      employeeId: AUTHORIZED_ID,
      result: AccessResult.AUTHORIZED,
      qrCodeRead: AUTHORIZED_ID,
    });
  });

  it('denies an employee without canAccessRiskAreas', async () => {
    employeesService.findById.mockResolvedValue(
      employee({ id: DENIED_ID, canAccessRiskAreas: false }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, DENIED_ID);

    expect(read.result).toBe(AccessResult.DENIED);
    expect(attempt.finalResult).toBe(AccessResult.DENIED);
  });

  it('marks the read as an invalid QR when the code matches no employee', async () => {
    employeesService.findById.mockResolvedValue(null);
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, UNKNOWN_ID);

    expect(read.result).toBe(AccessResult.INVALID_QR);
    expect(read.employeeId).toBeNull();
  });

  it('marks the read as invalid without querying the database when the scanned text is not uuid-shaped', async () => {
    const attempt = service.startAttempt();
    attempt.startDetection(1);

    const { read } = await service.recordRead(attempt.id, 'not-a-uuid');

    expect(read.result).toBe(AccessResult.INVALID_QR);
    expect(employeesService.findById).not.toHaveBeenCalled();
  });

  it('rejects a second read of the same QR in the same attempt as a duplicate', async () => {
    employeesService.findById.mockResolvedValue(
      employee({ id: AUTHORIZED_ID, canAccessRiskAreas: true }),
    );
    const attempt = service.startAttempt();
    attempt.startDetection(2);

    await service.recordRead(attempt.id, AUTHORIZED_ID);

    await expect(
      service.recordRead(attempt.id, AUTHORIZED_ID),
    ).rejects.toThrow(ConflictException);

    expect(accessEventRepository.record).toHaveBeenCalledWith({
      employeeId: null,
      result: AccessResult.DUPLICATE,
      qrCodeRead: AUTHORIZED_ID,
    });
    // the duplicate read must not count as a distinct read
    expect(attempt.reads).toHaveLength(1);
  });

  it('requires one distinct read per detected person before completing the attempt', async () => {
    employeesService.findById
      .mockResolvedValueOnce(employee({ id: AUTHORIZED_ID, canAccessRiskAreas: true }))
      .mockResolvedValueOnce(employee({ id: AUTHORIZED_ID_2, canAccessRiskAreas: true }));

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
    employeesService.findById
      .mockResolvedValueOnce(employee({ id: AUTHORIZED_ID, canAccessRiskAreas: true }))
      .mockResolvedValueOnce(employee({ id: DENIED_ID, canAccessRiskAreas: false }));

    const attempt = service.startAttempt();
    attempt.startDetection(2);

    await service.recordRead(attempt.id, AUTHORIZED_ID);
    await service.recordRead(attempt.id, DENIED_ID);

    expect(attempt.finalResult).toBe(AccessResult.DENIED);
  });
});
