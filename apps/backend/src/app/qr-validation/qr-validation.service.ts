import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { EmployeesService } from '../employees/employees.service';
import { AccessResult } from './entities/access-event.entity';
import {
  ACCESS_EVENT_REPOSITORY,
  IAccessEventRepository,
} from './repositories/access-event-repository.interface';
import { AccessAttemptStoreService } from './access-attempt-store.service';
import { AccessAttempt } from './access-attempt';
import { RecordedRead } from './access-attempt.types';

// O conteúdo do QR é o Employee.id (uuid) — checar o formato aqui evita bater
// no Postgres com um literal inválido para a coluna uuid (o driver rejeitaria
// com um erro de sintaxe em vez de simplesmente não encontrar ninguém).
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class QrValidationService {
  constructor(
    private readonly employeesService: EmployeesService,
    @Inject(ACCESS_EVENT_REPOSITORY)
    private readonly accessEventRepository: IAccessEventRepository,
    private readonly attemptStore: AccessAttemptStoreService,
  ) {}

  startAttempt(): AccessAttempt {
    return this.attemptStore.create();
  }

  getAttempt(attemptId: string): AccessAttempt {
    return this.attemptStore.get(attemptId);
  }

  startDetection(attemptId: string, personCount: number): AccessAttempt {
    const attempt = this.attemptStore.get(attemptId);
    attempt.startDetection(personCount);
    return attempt;
  }

  /**
   * Valida uma leitura de QR (o funcionário precisa de `canAccessRiskAreas`)
   * + checagem de duplicidade, persiste o AccessEvent correspondente, e
   * avança a máquina de estados da tentativa quando a leitura é aceita como
   * uma nova pessoa distinta.
   */
  async recordRead(
    attemptId: string,
    qrCode: string,
  ): Promise<{ attempt: AccessAttempt; read: RecordedRead }> {
    const attempt = this.attemptStore.get(attemptId);

    if (attempt.hasRead(qrCode)) {
      await this.accessEventRepository.record({
        employeeId: null,
        result: AccessResult.DUPLICATE,
        qrCodeRead: qrCode,
      });
      throw new ConflictException(
        'This QR code has already been used in this access attempt',
      );
    }

    const employee = UUID_SHAPE.test(qrCode)
      ? await this.employeesService.findById(qrCode)
      : null;
    const result = this.evaluateAuthorization(employee);

    await this.accessEventRepository.record({
      employeeId: employee?.id ?? null,
      result,
      qrCodeRead: qrCode,
    });

    const read: RecordedRead = {
      qrCode,
      employeeId: employee?.id ?? null,
      result,
    };

    // Avança a máquina de estados; lança ConflictException se a tentativa
    // não estiver em AWAITING_READS (ex.: já COMPLETE ou EXPIRED).
    attempt.recordRead(read);

    return { attempt, read };
  }

  private evaluateAuthorization(
    employee: { canAccessRiskAreas: boolean } | null,
  ): AccessResult {
    if (!employee) {
      return AccessResult.INVALID_QR;
    }
    return employee.canAccessRiskAreas ? AccessResult.AUTHORIZED : AccessResult.DENIED;
  }
}
