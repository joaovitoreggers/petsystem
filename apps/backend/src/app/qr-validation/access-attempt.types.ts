import { AccessResult } from './entities/access-event.entity';

export enum AttemptStatus {
  AWAITING_DETECTION = 'AWAITING_DETECTION',
  AWAITING_READS = 'AWAITING_READS',
  COMPLETE = 'COMPLETE',
  EXPIRED = 'EXPIRED',
}

export interface RecordedRead {
  qrCode: string;
  userId: string | null;
  result: AccessResult;
}
