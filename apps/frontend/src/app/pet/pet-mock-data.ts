// Mock data and pure helpers for the PET Digital screens. Everything here is
// static/deterministic (no backend calls) — ported from the product design
// mockup so the prototype can be reviewed before the real integration.

export type RiskAreaId = 'confinado' | 'quente' | 'altura' | 'eletrico' | 'maquinas';

export interface RiskArea {
  id: RiskAreaId;
  name: string;
  nr: string;
  description: string;
}

export const RISK_AREAS: RiskArea[] = [
  { id: 'confinado', name: 'Espaço confinado', nr: 'NR-33', description: 'Silos, moegas, tanques, elevatórias' },
  { id: 'quente', name: 'Trabalho a quente', nr: 'NR-18', description: 'Solda, corte, esmerilhamento' },
  { id: 'altura', name: 'Trabalho em altura', nr: 'NR-35', description: 'Acima de 2 m do nível inferior' },
  { id: 'eletrico', name: 'Serviço elétrico', nr: 'NR-10', description: 'Painéis, CCM, alta tensão' },
  { id: 'maquinas', name: 'Máquinas e bloqueio', nr: 'NR-12', description: 'Intervenção em equipamento motorizado' },
];

export function riskAreaName(id: RiskAreaId): string {
  return RISK_AREAS.find((a) => a.id === id)?.name ?? RISK_AREAS[0].name;
}
export function riskAreaNr(id: RiskAreaId): string {
  return RISK_AREAS.find((a) => a.id === id)?.nr ?? RISK_AREAS[0].nr;
}
export function riskAreaNames(ids: RiskAreaId[]): string {
  return ids.map(riskAreaName).join(' + ');
}
export function riskAreaNrs(ids: RiskAreaId[]): string {
  return ids.map(riskAreaNr).join(' · ');
}
export function requiresGasMonitoring(ids: RiskAreaId[]): boolean {
  return ids.some((id) => id === 'confinado' || id === 'quente');
}

export function dateToBr(iso: string): string {
  return `${iso.slice(8)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}
export function minutesToLabel(minutes: number): string {
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

export type GasKey = 'o2' | 'co' | 'h2s' | 'lel';

export interface GasLimit {
  label: string;
  unit: string;
  min?: number;
  max: number;
  limitText: string;
  decimals: number;
  scaleMax: number;
}

export const GAS_LIMITS: Record<GasKey, GasLimit> = {
  o2: { label: 'O₂', unit: '%', min: 19.5, max: 23, limitText: '19,5 – 23,0 %', decimals: 1, scaleMax: 25 },
  co: { label: 'CO', unit: 'ppm', max: 25, limitText: 'máx. 25 ppm', decimals: 0, scaleMax: 50 },
  h2s: { label: 'H₂S', unit: 'ppm', max: 8, limitText: 'máx. 8 ppm', decimals: 1, scaleMax: 20 },
  lel: { label: 'LEL', unit: '%', max: 10, limitText: 'máx. 10 %', decimals: 0, scaleMax: 30 },
};

export function isGasWithinLimit(key: GasKey, value: number): boolean {
  const limit = GAS_LIMITS[key];
  if (limit.min !== undefined && value < limit.min) return false;
  return value <= limit.max;
}

export interface ChecklistGroup {
  title: string;
  items: string[];
}

export const CHECKLISTS: Record<RiskAreaId, ChecklistGroup[]> = {
  confinado: [
    { title: 'EPI conferido em campo', items: ['Cinto paraquedista com trava-queda', 'Respirador com filtro adequado ao contaminante', 'Capacete com jugular', 'Luvas e botina de segurança'] },
    { title: 'Bloqueio e isolamento · NR-33', items: ['Bloqueio físico de energia aplicado — cadeado e etiqueta', 'Sistema despressurizado e drenado', 'Válvulas de entrada travadas', 'Ventilação forçada instalada', 'Vigia posicionado externamente', 'Plano de resgate acionável'] },
  ],
  quente: [
    { title: 'EPI conferido em campo', items: ['Máscara de solda com filtro adequado', 'Avental e mangote de raspa', 'Luvas de solda', 'Protetor auricular'] },
    { title: 'Prevenção de incêndio · NR-18', items: ['Área isolada e sinalizada no raio definido', 'Combustíveis removidos ou cobertos com manta', 'Extintores posicionados e inspecionados', 'Detector de gás inflamável zerado (LEL 0%)', 'Vigia de fogo escalado para 60 min após o término'] },
  ],
  altura: [
    { title: 'EPI conferido em campo', items: ['Cinto paraquedista com duplo talabarte', 'Trava-queda retrátil', 'Capacete com jugular', 'Calçado antiderrapante'] },
    { title: 'Sistema de ancoragem · NR-35', items: ['Ponto de ancoragem certificado e inspecionado', 'Linha de vida instalada e testada', 'Projeção no piso isolada e sinalizada', 'Ferramentas amarradas ao cinto', 'Condição climática avaliada (vento e chuva)'] },
  ],
  eletrico: [
    { title: 'EPI conferido em campo', items: ['Vestimenta antiarco com ATPV compatível', 'Luva isolante de classe adequada', 'Capacete com viseira de policarbonato', 'Calçado isolante'] },
    { title: 'Desenergização · NR-10', items: ['Seccionamento do circuito', 'Impedimento de reenergização — cadeado e etiqueta', 'Constatação da ausência de tensão', 'Instalação de aterramento temporário', 'Sinalização e delimitação da zona controlada'] },
  ],
  maquinas: [
    { title: 'EPI conferido em campo', items: ['Luvas de proteção mecânica', 'Óculos de segurança', 'Capacete', 'Calçado de segurança'] },
    { title: 'Bloqueio LOTO · NR-12', items: ['Parada do equipamento pelo comando local', 'Cadeado e etiqueta individual por executante', 'Energias residuais dissipadas', 'Teste de tentativa de partida realizado', 'Proteções fixas e móveis mapeadas para remontagem'] },
  ],
};

export interface ExtraField {
  name: string;
  label: string;
  value: string;
}

export const EXTRA_FIELDS: Record<RiskAreaId, ExtraField[]> = {
  confinado: [
    { name: 'x1', label: 'Tipo de espaço confinado', value: 'Silo vertical de grãos' },
    { name: 'x2', label: 'Aberturas de acesso', value: '1 boca superior · 0,60 m' },
    { name: 'x3', label: 'Vigia externo designado', value: 'Marcos D. Wolff · mat. 05221' },
    { name: 'x4', label: 'Equipe de resgate acionável', value: 'Brigada Matelândia · ramal 4144' },
    { name: 'x5', label: 'Ventilação forçada', value: 'Exaustor 2.500 m³/h — 20 min antes' },
  ],
  quente: [
    { name: 'x1', label: 'Processo de trabalho a quente', value: 'Solda MIG e esmerilhamento' },
    { name: 'x2', label: 'Raio de isolamento da área', value: '11 m · fita zebrada e placas' },
    { name: 'x3', label: 'Materiais combustíveis', value: 'Pó de grão e paletes retirados' },
    { name: 'x4', label: 'Recurso de combate a incêndio', value: '2 extintores PQS 12 kg + mangotinho' },
    { name: 'x5', label: 'Vigia de fogo (60 min após)', value: 'Alan P. Kuhn · mat. 06712' },
  ],
  altura: [
    { name: 'x1', label: 'Altura do trabalho', value: '14,5 m — topo da torre' },
    { name: 'x2', label: 'Meio de acesso', value: 'Escada fixa com linha de vida vertical' },
    { name: 'x3', label: 'Ponto de ancoragem certificado', value: 'AN-07 · 22 kN · inspecionado 08/2026' },
    { name: 'x4', label: 'Isolamento da projeção no piso', value: 'Perímetro de 6 m sinalizado' },
    { name: 'x5', label: 'Plano de resgate em altura', value: 'Tripé e talha de resgate no local' },
  ],
  eletrico: [
    { name: 'x1', label: 'Tensão de trabalho', value: '440 V · baixa tensão' },
    { name: 'x2', label: 'Painel / circuito', value: 'CCM-03 · disjuntor Q12' },
    { name: 'x3', label: 'Estado do circuito', value: 'Desenergizado conforme NR-10' },
    { name: 'x4', label: 'Aterramento temporário', value: 'Aplicado nas três fases' },
    { name: 'x5', label: 'Teste de ausência de tensão', value: 'Fluke 1587 · 09:24 · 0 V' },
  ],
  maquinas: [
    { name: 'x1', label: 'Equipamento', value: 'Extrusora EX-02' },
    { name: 'x2', label: 'TAG do ativo', value: 'ITA-EXT-002' },
    { name: 'x3', label: 'Pontos de bloqueio de energia', value: '3 elétricos · 1 pneumático' },
    { name: 'x4', label: 'Cadeados aplicados', value: '4 · vermelho de manutenção' },
    { name: 'x5', label: 'Energia residual dissipada', value: 'Ar comprimido purgado · inércia parada' },
  ],
};

export const BASE_ACTIVITY: Record<RiskAreaId, { description: string; type: string; location: string }> = {
  confinado: { description: 'Limpeza técnica interna e inspeção de parede do silo após descarga de milho.', type: 'Limpeza técnica', location: 'Silo de milho 04 — boca superior' },
  quente: { description: 'Solda de reforço estrutural na tubulação de vapor da casa de caldeiras.', type: 'Manutenção corretiva', location: 'Casa de caldeiras 02 — linha de vapor 4"' },
  altura: { description: 'Substituição de aletas e inspeção estrutural do topo da torre de resfriamento.', type: 'Manutenção preventiva', location: 'Torre de resfriamento 01 — plataforma superior' },
  eletrico: { description: 'Troca de contator e reaperto de barramento no centro de controle de motores.', type: 'Manutenção corretiva', location: 'CCM-03 — sala elétrica do frigorífico' },
  maquinas: { description: 'Substituição da rosca de alimentação com bloqueio total do equipamento.', type: 'Manutenção corretiva', location: 'Linha de extrusão — extrusora EX-02' },
};

export const AREA_NOTE: Record<RiskAreaId, string> = {
  confinado: 'Espaço confinado (NR-33): o fluxo inclui medição atmosférica contínua, vigia externo e plano de resgate antes da liberação.',
  quente: 'Trabalho a quente (NR-18): o fluxo inclui medição de gás inflamável, isolamento da área e vigia de fogo por 60 min após o término.',
  altura: 'Trabalho em altura (NR-35): o fluxo exige ancoragem certificada, linha de vida testada e plano de resgate — sem etapa de medição atmosférica.',
  eletrico: 'Serviço elétrico (NR-10): o fluxo exige desenergização, teste de ausência de tensão e aterramento temporário registrados.',
  maquinas: 'Máquinas e bloqueio (NR-12): o fluxo exige cadeado individual por executante e teste de tentativa de partida.',
};

export type WizardStepId = 'area' | 'atividade' | 'gases' | 'qr' | 'check' | 'sig';

export const STEP_NAME: Record<WizardStepId, string> = {
  area: 'Área de risco',
  atividade: 'Atividade e local',
  gases: 'Medição atmosférica',
  qr: 'Crachá e permissão',
  check: 'Checklist e foto',
  sig: 'Assinaturas',
};

export function stepsFor(ids: RiskAreaId[]): WizardStepId[] {
  return ['area', 'atividade', ...(requiresGasMonitoring(ids) ? (['gases'] as const) : []), 'qr', 'check', 'sig'];
}

export type BadgeItemStatus = 'ok' | 'prox' | 'venc';

export interface BadgeItem {
  name: string;
  status: BadgeItemStatus;
  value: string;
}

export interface Badge {
  name: string;
  registration: string;
  role: string;
  company: string;
  items: BadgeItem[];
}

export const BADGE_STATUS: Record<BadgeItemStatus, { color: string; icon: string }> = {
  ok: { color: 'var(--status-ok)', icon: '✓' },
  prox: { color: 'var(--status-warn)', icon: '!' },
  venc: { color: 'var(--status-bad)', icon: '✕' },
};

export const MOCK_BADGES: Badge[] = [
  {
    name: 'Jonas R. Kirchner',
    registration: '04812',
    role: 'Mecânico industrial',
    company: 'Lar · Manutenção',
    items: [
      { name: 'ASO ocupacional', status: 'ok', value: 'válido até 14/03/2027' },
      { name: 'NR-33 trabalhador autorizado', status: 'ok', value: 'válido até 08/02/2027' },
      { name: 'NR-35 trabalho em altura', status: 'ok', value: 'válido até 21/11/2026' },
    ],
  },
  {
    name: 'Elaine M. Sobczak',
    registration: '07330',
    role: 'Eletricista',
    company: 'Termoeletro Ltda · terceiro',
    items: [
      { name: 'ASO ocupacional', status: 'ok', value: 'válido até 09/01/2027' },
      { name: 'NR-10 reciclagem bienal', status: 'prox', value: 'vence em 21 dias · 26/09/2026' },
      { name: 'NR-33 trabalhador autorizado', status: 'prox', value: 'vence em 9 dias · 14/09/2026' },
    ],
  },
  {
    name: 'Cleiton A. Ferraz',
    registration: '09104',
    role: 'Auxiliar de manutenção',
    company: 'Termoeletro Ltda · terceiro',
    items: [
      { name: 'ASO ocupacional', status: 'venc', value: 'vencido em 22/07/2026' },
      { name: 'NR-33 trabalhador autorizado', status: 'venc', value: 'vencido em 05/05/2026' },
      { name: 'Integração de terceiros', status: 'ok', value: 'válido até 03/12/2026' },
    ],
  },
];

export type PetStatus = 'aberta' | 'fechada' | 'ocorrencia' | 'alarme';

export const PET_STATUS: Record<PetStatus, { label: string; fg: string; bg: string }> = {
  aberta: { label: 'aberta', fg: '#1d4d33', bg: '#dff0e6' },
  alarme: { label: 'em alarme', fg: '#fdf3f3', bg: 'var(--status-bad)' },
  fechada: { label: 'encerrada', fg: 'var(--color-neutral-800)', bg: 'var(--color-neutral-200)' },
  ocorrencia: { label: 'ocorrência', fg: 'var(--status-bad)', bg: '#f6e3e3' },
};

export interface GasReading {
  o2: number;
  co: number;
  h2s: number;
  lel: number;
}

export interface Pet {
  id: string;
  areas: RiskAreaId[];
  location: string;
  unit: string;
  teamSize: number;
  date: string;
  start: string;
  end: string;
  timeLabel: string;
  technician: string;
  status: PetStatus;
  coordinates: string;
  gas?: GasReading;
  alarm?: boolean;
  durationMinutes?: number;
}

export const MOCK_PETS: Pet[] = [
  { id: 'PET-2026-0418', areas: ['confinado'], location: 'Silo de milho 04 · Matelândia', unit: 'Matelândia', teamSize: 3, date: '2026-09-05', start: '09:42', end: '', timeLabel: '09:42', technician: 'B. Garlini', status: 'aberta', coordinates: '-25.2531, -53.9927', gas: { o2: 20.8, co: 2, h2s: 0.2, lel: 1 } },
  { id: 'PET-2026-0417', areas: ['confinado', 'eletrico'], location: 'Elevatória da ETE · Medianeira', unit: 'Medianeira', teamSize: 2, date: '2026-09-05', start: '08:15', end: '', timeLabel: '08:15', technician: 'R. Hoffmann', status: 'aberta', coordinates: '-25.2952, -54.0940', gas: { o2: 20.1, co: 6, h2s: 11.4, lel: 3 }, alarm: true },
  { id: 'PET-2026-0416', areas: ['quente', 'altura'], location: 'Casa de caldeiras 02 · Matelândia', unit: 'Matelândia', teamSize: 4, date: '2026-09-05', start: '07:30', end: '', timeLabel: '07:30', technician: 'B. Garlini', status: 'aberta', coordinates: '-25.2540, -53.9911', gas: { o2: 20.9, co: 14, h2s: 0, lel: 4 } },
  { id: 'PET-2026-0415', areas: ['eletrico', 'maquinas'], location: 'Túnel de congelamento · Matelândia', unit: 'Matelândia', teamSize: 2, date: '2026-09-04', start: '13:20', end: '15:30', timeLabel: 'ontem', technician: 'B. Garlini', status: 'fechada', coordinates: '', durationMinutes: 130 },
  { id: 'PET-2026-0414', areas: ['altura'], location: 'Torre de resfriamento · Céu Azul', unit: 'Céu Azul', teamSize: 3, date: '2026-09-04', start: '08:05', end: '12:40', timeLabel: 'ontem', technician: 'A. Beal', status: 'fechada', coordinates: '', durationMinutes: 275 },
  { id: 'PET-2026-0412', areas: ['confinado', 'quente'], location: 'Moega de recebimento 01 · Missal', unit: 'Missal', teamSize: 5, date: '2026-09-02', start: '14:10', end: '14:36', timeLabel: '02/09', technician: 'A. Beal', status: 'ocorrencia', coordinates: '', durationMinutes: 26 },
  { id: 'PET-2026-0410', areas: ['maquinas'], location: 'Linha de extrusão · Itaipulândia', unit: 'Itaipulândia', teamSize: 2, date: '2026-09-01', start: '09:00', end: '10:48', timeLabel: '01/09', technician: 'R. Hoffmann', status: 'fechada', coordinates: '', durationMinutes: 108 },
  { id: 'PET-2026-0409', areas: ['confinado'], location: 'Silo de soja 09 · Itaipulândia', unit: 'Itaipulândia', teamSize: 4, date: '2026-08-31', start: '07:15', end: '11:05', timeLabel: '31/08', technician: 'R. Hoffmann', status: 'fechada', coordinates: '', durationMinutes: 230 },
  { id: 'PET-2026-0405', areas: ['quente'], location: 'Oficina de manutenção · Matelândia', unit: 'Matelândia', teamSize: 2, date: '2026-08-28', start: '13:40', end: '16:10', timeLabel: '28/08', technician: 'B. Garlini', status: 'fechada', coordinates: '', durationMinutes: 150 },
  { id: 'PET-2026-0398', areas: ['confinado', 'maquinas'], location: 'Tanque de efluente 02 · Medianeira', unit: 'Medianeira', teamSize: 3, date: '2026-08-27', start: '08:30', end: '08:52', timeLabel: '27/08', technician: 'A. Beal', status: 'ocorrencia', coordinates: '', durationMinutes: 22 },
  { id: 'PET-2026-0392', areas: ['altura', 'eletrico'], location: 'Subestação — pórtico 1 · Céu Azul', unit: 'Céu Azul', teamSize: 3, date: '2026-08-22', start: '07:50', end: '12:20', timeLabel: '22/08', technician: 'R. Hoffmann', status: 'fechada', coordinates: '', durationMinutes: 270 },
  { id: 'PET-2026-0385', areas: ['maquinas'], location: 'Linha de abate — nória · Matelândia', unit: 'Matelândia', teamSize: 2, date: '2026-08-18', start: '15:10', end: '17:25', timeLabel: '18/08', technician: 'B. Garlini', status: 'fechada', coordinates: '', durationMinutes: 135 },
];

export const INCIDENT_CAUSE: Record<string, string> = {
  'PET-2026-0412': 'LEL atingiu 14% durante a limpeza da moega. Equipe evacuada em 90 s pelo alerta do painel; serviço reprogramado com ventilação forçada prévia.',
  'PET-2026-0398': 'Partida acidental do agitador com a equipe no entorno do tanque. Bloqueio LOTO estava aplicado em apenas dois dos três pontos de energia.',
};

export interface DayReading {
  total: number;
  outOfRange: number;
  isWeekend: boolean;
  iso: string;
  dayLabel: string;
  dayShort: string;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}

export const THIRTY_DAY_READINGS: DayReading[] = (() => {
  const rnd = seededRandom(20260905);
  const today = new Date(2026, 8, 5);
  const out: DayReading[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const total = isWeekend ? 8 + Math.round(rnd() * 10) : 34 + Math.round(rnd() * 26);
    const r = rnd();
    const outOfRange = Math.min(total, r > 0.88 ? 3 + Math.round(rnd() * 3) : r > 0.62 ? 1 + Math.round(rnd() * 1) : 0);
    const pad = (v: number) => String(v).padStart(2, '0');
    out.push({
      total,
      outOfRange,
      isWeekend,
      iso: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      dayLabel: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`,
      dayShort: pad(d.getDate()),
    });
  }
  return out;
})();

export interface DocumentType {
  code: string;
  description: string;
}

export const DOCUMENT_TYPES: DocumentType[] = [
  { code: 'ASO', description: 'Atestado de saúde ocupacional' },
  { code: 'NR-33', description: 'Espaço confinado · trabalhador autorizado' },
  { code: 'NR-18', description: 'Trabalho a quente' },
  { code: 'NR-35', description: 'Trabalho em altura' },
  { code: 'NR-10', description: 'Segurança em instalações elétricas' },
  { code: 'NR-12', description: 'Máquinas e equipamentos · bloqueio' },
  { code: 'NR-13', description: 'Caldeiras e vasos de pressão' },
];

export interface TeamMember {
  name: string;
  registration: string;
  role: string;
  company: string;
  unit: string;
  isThirdParty?: boolean;
  documents: Record<string, string>;
}

export const TEAM_MEMBERS: TeamMember[] = [
  { name: 'Jonas R. Kirchner', registration: '04812', role: 'Mecânico industrial', company: 'Lar · Manutenção', unit: 'Matelândia', documents: { ASO: '2027-03-14', 'NR-33': '2027-02-08', 'NR-35': '2026-11-21', 'NR-12': '2027-05-30' } },
  { name: 'Elaine M. Sobczak', registration: '07330', role: 'Eletricista', company: 'Termoeletro Ltda', unit: 'Medianeira', isThirdParty: true, documents: { ASO: '2027-01-09', 'NR-10': '2026-09-26', 'NR-33': '2026-09-14', 'NR-35': '2027-07-02' } },
  { name: 'Cleiton A. Ferraz', registration: '09104', role: 'Auxiliar de manutenção', company: 'Termoeletro Ltda', unit: 'Medianeira', isThirdParty: true, documents: { ASO: '2026-07-22', 'NR-33': '2026-05-05', 'NR-12': '2026-12-03' } },
  { name: 'Marcos D. Wolff', registration: '05221', role: 'Operador de silo · vigia', company: 'Lar · Armazéns', unit: 'Matelândia', documents: { ASO: '2027-04-18', 'NR-33': '2027-01-30', 'NR-35': '2026-12-12' } },
  { name: 'Alan P. Kuhn', registration: '06712', role: 'Soldador · vigia de fogo', company: 'Lar · Manutenção', unit: 'Matelândia', documents: { ASO: '2026-09-19', 'NR-18': '2027-03-03', 'NR-33': '2026-10-08', 'NR-35': '2027-02-14' } },
  { name: 'Rafael Hoffmann', registration: '02988', role: 'Téc. Segurança do Trabalho', company: 'Lar · SESMT', unit: 'Medianeira', documents: { ASO: '2027-06-11', 'NR-33': '2027-06-11', 'NR-35': '2027-06-11', 'NR-10': '2027-04-25' } },
  { name: 'Adriana Beal', registration: '03540', role: 'Téc. Segurança do Trabalho', company: 'Lar · SESMT', unit: 'Céu Azul', documents: { ASO: '2027-02-27', 'NR-33': '2026-09-28', 'NR-35': '2027-01-16' } },
  { name: 'Diego F. Ostrovski', registration: '08455', role: 'Montador industrial', company: 'Altura Serviços ME', unit: 'Céu Azul', isThirdParty: true, documents: { ASO: '2026-10-30', 'NR-35': '2026-09-11', 'NR-18': '2027-01-22' } },
  { name: 'Simone K. Bertoldi', registration: '07106', role: 'Operadora de ETE', company: 'Lar · Utilidades', unit: 'Medianeira', documents: { ASO: '2027-05-08', 'NR-33': '2027-03-19' } },
  { name: 'Vilmar J. Radaelli', registration: '01877', role: 'Mecânico de extrusão', company: 'Lar · Manutenção', unit: 'Itaipulândia', documents: { ASO: '2026-08-14', 'NR-12': '2026-06-27', 'NR-33': '2027-04-02' } },
  { name: 'Patrícia L. Menegat', registration: '09630', role: 'Caldeireira', company: 'Lar · Utilidades', unit: 'Matelândia', documents: { ASO: '2027-07-21', 'NR-18': '2026-09-29', 'NR-13': '2027-02-05' } },
  { name: 'Éder S. Vasconcelos', registration: '08201', role: 'Eletricista de manutenção', company: 'Lar · Manutenção', unit: 'Missal', documents: { ASO: '2027-01-25', 'NR-10': '2027-08-09', 'NR-35': '2026-09-23', 'NR-12': '2027-03-11' } },
];

const TODAY = new Date(2026, 8, 5);

export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - TODAY.getTime()) / 86400000);
}

export interface MonitorArchive {
  readingCount: number;
  range: Record<GasKey, [number, number, number]>;
  outOfRange: number;
}

export function buildMonitorArchive(pet: Pet): MonitorArchive {
  let seed = 0;
  for (let i = 0; i < pet.id.length; i++) seed = (seed * 31 + pet.id.charCodeAt(i)) & 0x7fffffff;
  const rnd = seededRandom(seed);
  const bad = pet.status === 'ocorrencia';
  const alarm = !!pet.alarm;
  const confinedOrHot = pet.areas.some((a) => a === 'confinado' || a === 'quente');
  const readingCount = Math.max(18, Math.round((pet.durationMinutes ?? 190) / 2));
  const range: Record<GasKey, [number, number, number]> = {
    o2: alarm ? [19.6, 20.1, 20.7] : bad ? [18.6, 19.4, 20.4] : [20.2, 20.7, 21.0],
    co: alarm ? [1, 5 + rnd() * 2, 9 + rnd() * 3] : confinedOrHot ? [0, 3 + rnd() * 4, 9 + rnd() * 8] : [0, 1 + rnd() * 2, 4 + rnd() * 3],
    h2s: alarm ? [0.6, 6.4 + rnd(), 11.2 + rnd() * 1.4] : bad ? [0.4, 3.2 + rnd() * 2, 9.8 + rnd() * 3] : [0, rnd() * 0.6, 0.8 + rnd() * 1.4],
    lel: alarm ? [0, 3 + rnd() * 2, 6 + rnd() * 2] : bad ? [0, 5 + rnd() * 3, 12 + rnd() * 4] : [0, 1 + rnd() * 2, 3 + rnd() * 3],
  };
  const outOfRange = alarm ? 9 + Math.round(rnd() * 6) : bad ? 4 + Math.round(rnd() * 4) : Math.round(rnd() * 2);
  return { readingCount, range, outOfRange };
}
