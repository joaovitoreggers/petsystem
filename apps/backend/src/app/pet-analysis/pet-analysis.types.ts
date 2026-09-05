// Mesmos 5 códigos de RiskAreaId do front-end (apps/frontend/src/app/pet/pet-mock-data.ts),
// duplicados aqui só para dar um rótulo legível no resumo enviado à IA — não
// há uma lib compartilhada entre os dois apps neste monorepo.
export const AREA_INFO: { id: string; label: string; nr: string }[] = [
  { id: 'confinado', label: 'Espaço confinado', nr: 'NR-33' },
  { id: 'quente', label: 'Trabalho a quente', nr: 'NR-18' },
  { id: 'altura', label: 'Trabalho em altura', nr: 'NR-35' },
  { id: 'eletrico', label: 'Serviço elétrico', nr: 'NR-10' },
  { id: 'maquinas', label: 'Máquinas e bloqueio', nr: 'NR-12' },
];

export interface AreaStat {
  areaId: string;
  areaLabel: string;
  nr: string;
  total: number;
  occurrences: number;
  occurrenceRate: number;
}

export interface DailyStat {
  date: string;
  count: number;
}

export interface PetAnalysisSummary {
  totalCount: number;
  openCount: number;
  closedCount: number;
  totalOccurrences: number;
  avgPerDay: number;
  byArea: AreaStat[];
  byDate: DailyStat[];
  unusualDays: DailyStat[];
  unusualAreas: AreaStat[];
}

export interface PetAnalysisResult {
  generatedAt: string;
  summary: PetAnalysisSummary;
  reportText: string;
}
