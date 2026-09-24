import { CloseWorkPermitDto } from './dto/close-work-permit.dto';

/**
 * Mesma ideia de opening-snapshot.ts, para o encerramento — precisa ficar em
 * sincronia com `closingContentSnapshot()` no front-end
 * (`pet-technician.component.ts`).
 */
export function buildClosingSnapshot(
  workPermitId: string,
  dto: Pick<CloseWorkPermitDto, 'end' | 'durationMinutes' | 'reason'>,
): Record<string, unknown> {
  return {
    workPermitId,
    end: dto.end,
    durationMinutes: dto.durationMinutes,
    reason: dto.reason ?? null,
  };
}
