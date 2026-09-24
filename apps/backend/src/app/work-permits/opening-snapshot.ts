import { CreateWorkPermitDto } from './dto/create-work-permit.dto';

/**
 * Campos do corpo de criação que representam o que de fato foi assinado —
 * exclui `draftId` (não é conteúdo) e `technician`/`coordinates` (derivados
 * da assinatura/geolocalização, não atestados pelo signatário). Usado tanto
 * para computar o hash de cada assinatura (ver WorkPermitSignaturesService)
 * quanto para validar, na criação de fato, que o conteúdo não mudou desde
 * que foi assinado.
 *
 * Precisa ficar em sincronia com `openingContentSnapshot()` no front-end
 * (`pet-state.service.ts`) — é o mesmo objeto, construído dos dois lados a
 * partir dos mesmos campos, cujo hash tem que bater.
 */
export function buildOpeningSnapshot(dto: CreateWorkPermitDto): Record<string, unknown> {
  return {
    areas: dto.areas,
    location: dto.location,
    unit: dto.unit,
    teamSize: dto.teamSize,
    date: dto.date,
    start: dto.start,
    gas: dto.gas ?? null,
    criticalAlerts: dto.criticalAlerts ?? [],
    team: dto.team ?? [],
    companyPhone: dto.companyPhone ?? null,
    description: dto.description ?? null,
    serviceType: dto.serviceType ?? null,
    executingCompany: dto.executingCompany ?? null,
    plannedStart: dto.plannedStart ?? null,
    plannedEnd: dto.plannedEnd ?? null,
    checklist: dto.checklist ?? {},
    fireWatchRounds: dto.fireWatchRounds ?? [],
  };
}
