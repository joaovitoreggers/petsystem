import { AccessEvent, AccessResult } from '../entities/access-event.entity';

export interface RecordEventData {
  employeeId: string | null;
  result: AccessResult;
  qrCodeRead: string | null;
}

/**
 * Repository pattern: isolates data access for AccessEvent from the ORM choice.
 */
export interface IAccessEventRepository {
  record(data: RecordEventData): Promise<AccessEvent>;
}

export const ACCESS_EVENT_REPOSITORY = Symbol('ACCESS_EVENT_REPOSITORY');
