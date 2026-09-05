import { ReadDto, ReadResult } from './services/qr-validation-api.service';

/**
 * State pattern explícito (como uma união discriminada) espelhando a máquina
 * de estados AccessAttempt do back-end, em vez de um monte de flags booleanas.
 */
export type ScannerState =
  | { type: 'idle' }
  | { type: 'preparing_camera' }
  | { type: 'awaiting_detection' }
  | {
      type: 'awaiting_reads';
      attemptId: string;
      expectedCount: number;
      reads: ReadDto[];
    }
  | {
      type: 'complete';
      reads: ReadDto[];
      finalResult: ReadResult;
    }
  | { type: 'expired' }
  | { type: 'error'; message: string };
