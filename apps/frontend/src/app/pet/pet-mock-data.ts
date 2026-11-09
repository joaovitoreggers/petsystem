// Tipos, constantes normativas (áreas de risco, checklists, limites de gás) e
// funções puras das telas do PET Digital. Não há dados de exemplo aqui — o
// conteúdo real vem do back-end (ver PetStateService).
//
// O checklist, os campos de EPI e as áreas de risco abaixo foram conferidos
// contra a PET física em papel da Lar (FO 060 330-37, v5 09/2025) — ver
// CHECKLISTS, EPI_CHECKLIST e a área 'descarga'. Exceção: 'confinado'
// (NR-33) segue o Anexo II (Modelo de PET) oficial da norma, não mais a
// aproximação da PET da Lar — ver o comentário junto de CHECKLISTS.confinado.

// De propósito, restrito às 7 normas que o sistema cobre por enquanto —
// NR-33/35/10/12/20 já tinham checklist na PET física da Lar; NR-34
// (naval) e NR-37 (plataforma) foram adicionadas com checklist próprio,
// mas sem PET de exemplo — a Lar é agroindustrial, não tem operação naval
// nem offshore. Trabalho a quente (NR-18) e içamento (NR-11) saíram do
// escopo aqui — ver histórico de PETs que usavam NR-18, reatribuídas para
// a área que melhor representa o mesmo serviço.
export type RiskAreaId = 'confinado' | 'altura' | 'eletrico' | 'maquinas' | 'descarga' | 'naval' | 'plataforma';

export interface RiskArea {
  id: RiskAreaId;
  name: string;
  nr: string;
  description: string;
}

export const RISK_AREAS: RiskArea[] = [
  { id: 'confinado', name: 'Espaço confinado', nr: 'NR-33', description: 'Silos, moegas, tanques, elevatórias' },
  { id: 'altura', name: 'Trabalho em altura', nr: 'NR-35', description: 'Acima de 2 m do nível inferior' },
  { id: 'eletrico', name: 'Serviço elétrico', nr: 'NR-10', description: 'Painéis, CCM, alta tensão' },
  { id: 'maquinas', name: 'Máquinas e bloqueio', nr: 'NR-12', description: 'Intervenção em equipamento motorizado' },
  { id: 'descarga', name: 'Descarga de gases/líquidos', nr: 'NR-20', description: 'Caminhão-tanque, produtos inflamáveis' },
  { id: 'naval', name: 'Indústria naval', nr: 'NR-34', description: 'Construção, reparo ou desmonte de embarcações — docas, estaleiros, tanques' },
  { id: 'plataforma', name: 'Plataforma de petróleo', nr: 'NR-37', description: 'Operações em plataforma fixa ou flutuante — processo, embarque, offshore' },
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
  return ids.some((id) => id === 'confinado' || id === 'naval' || id === 'plataforma');
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

// Mensagem de violação para uma leitura manual fora do limite — null quando
// o valor está dentro da faixa segura.
export function gasViolationMessage(key: GasKey, value: number): string | null {
  const limit = GAS_LIMITS[key];
  const v = value.toFixed(limit.decimals);
  if (limit.min !== undefined && value < limit.min) {
    return `${limit.label} em ${v} ${limit.unit}, abaixo do mínimo de ${limit.min} ${limit.unit}.`;
  }
  if (value > limit.max) {
    return `${limit.label} em ${v} ${limit.unit}, acima do limite de ${limit.max} ${limit.unit}.`;
  }
  return null;
}

// SIM / NÃO / NA — mesmo modelo de resposta da PET em papel (substituiu a
// caixa de marcar simples: "não aplicável" é uma resposta válida e distinta
// de "não").
export type ChecklistAnswer = 'sim' | 'nao' | 'na';

export interface ChecklistGroup {
  title: string;
  items: string[];
}

// Checklists de confinado, altura e descarga transcritos da PET física da
// Lar (FO 060 330-37). Elétrico e máquinas não aparecem nessa folha — a
// empresa provavelmente usa uma PET própria para elétrica — então mantêm o
// checklist genérico que já existia. Naval (NR-34) e plataforma (NR-37) são
// checklists novos, escritos a partir do texto das normas — sem PET física
// de referência, já que a Lar não opera nesses dois setores.
export const CHECKLISTS: Record<RiskAreaId, ChecklistGroup[]> = {
  // Transcrito item a item do Anexo II (Modelo de PET) da NR-33, vigente
  // desde 03/10/2022 (Portaria MTP n.º 1.690/2022) — não é mais a
  // aproximação da PET física da Lar, é o modelo oficial. Os testes
  // atmosféricos (itens 2 e 6 do anexo) não viram pergunta SIM/NÃO aqui:
  // os valores numéricos (O₂, LEL) já são capturados pela etapa "Medição
  // atmosférica" do assistente, com os mesmos limites do anexo (O₂ entre
  // 19,5% e 23,0%; inflamáveis abaixo de 10% LEL — ver
  // requiresGasMonitoring/atmosphereOutOfRange) — duplicar como checklist
  // criaria dois lugares para a mesma resposta divergirem.
  confinado: [
    {
      title: 'Antes da entrada · isolamento e testes (itens 1, 3-7)',
      items: [
        'Isolamento da área realizado?',
        'Bloqueio, travamento e etiquetagem realizados, quando aplicável?',
        'Purga e/ou lavagem realizadas, quando aplicável?',
        'Ventilação/exaustão adequada — tipo, equipamento e tempo registrados?',
        'Teste após ventilação e isolamento dentro dos limites? (O₂ entre 19,5% e 23,0%; inflamáveis abaixo de 10% LEL)',
        'Iluminação geral adequada?',
      ],
    },
    {
      title: 'Antes da entrada · comunicação, resgate e treinamento (itens 8-11)',
      items: [
        'Procedimentos de comunicação definidos?',
        'Procedimentos de resgate definidos?',
        'Procedimentos e proteção de movimentação vertical definidos?',
        'Todos os trabalhadores têm treinamento válido em NR-33?',
      ],
    },
    {
      title: 'Equipamentos · monitoramento e proteção coletiva (item 13)',
      items: [
        'Equipamento de monitoramento contínuo de gases, com alarmes, em condições?',
        'Lanternas em condições?',
        'Roupa de proteção disponível?',
        'Extintores de incêndio disponíveis?',
        'Capacetes, botas e luvas disponíveis?',
        'Escada disponível e em condições?',
        'Equipamentos de movimentação vertical/suportes externos disponíveis?',
      ],
    },
    {
      title: 'Equipamentos · respiração, resgate e áreas explosivas (item 13)',
      items: [
        'Equipamento de proteção respiratória autônomo (ou ar mandado com cilindro de escape) para os trabalhadores autorizados?',
        'Cinturão de segurança e linhas de vida para os trabalhadores autorizados?',
        'Cinturão de segurança e linhas de vida para a equipe de resgate?',
        'Equipamento de proteção respiratória autônomo (ou ar mandado com cilindro de escape) para a equipe de resgate?',
        'Equipamentos de comunicação eletrônica adequados para áreas potencialmente explosivas?',
        'Equipamentos elétricos e eletrônicos adequados para áreas potencialmente explosivas?',
      ],
    },
    {
      title: 'Durante os trabalhos (item 14)',
      items: ['Permissão de trabalhos a quente emitida, quando aplicável?'],
    },
  ],
  // A partir daqui, os demais grupos foram reduzidos ao mínimo necessário
  // pra abrir a PET — o que sobrou é só o essencial de cada norma. O que
  // cada empresa quiser conferir além disso (itens específicos da própria
  // operação) entra pela aba "Checklist" (ver ChecklistCustomItem), não
  // aqui — esta lista é o ponto de partida fixo, não o teto.
  altura: [
    {
      title: 'Condições gerais · NR-35',
      items: [
        'Trabalhador com treinamento válido em NR-35?',
        'Área está sinalizada e isolada?',
        'Pontos seguros de ancoragem e linha de vida instalada?',
        'Ausência de condições impeditivas? (clima, etc.)',
      ],
    },
  ],
  naval: [
    {
      title: 'Condições gerais · NR-34',
      items: [
        'Permissão de Trabalho (PT) específica emitida e visível no local?',
        'Certificado de teste atmosférico (gás-livre) válido para a área?',
        'Área isolada e sinalizada a bordo ou no estaleiro?',
        'Rotas de fuga e ponto de encontro identificados?',
      ],
    },
  ],
  plataforma: [
    {
      title: 'Condições gerais · NR-37',
      items: [
        'Treinamento de sobrevivência e escape (HUET) válido?',
        'Permissão de Trabalho (PT) da plataforma emitida e assinada?',
        'Detecção de gás (H₂S/LEL) testada na área?',
        'Rota de abandono de plataforma e ponto de reunião confirmados?',
      ],
    },
  ],
  descarga: [
    {
      title: 'Motorista, veículo e área · NR-20',
      items: [
        'Motorista capacitado NR-20 / MOPP?',
        'Área está sinalizada e isolada?',
        'Caminhão está aterrado?',
        'Ausência de fontes de ignição/equipamentos elétricos na área?',
      ],
    },
  ],
  eletrico: [
    {
      title: 'Desenergização · NR-10',
      items: [
        'Seccionamento do circuito realizado?',
        'Impedimento de reenergização (cadeado e etiqueta) aplicado?',
        'Constatação da ausência de tensão realizada?',
        'Aterramento temporário instalado?',
      ],
    },
  ],
  maquinas: [
    {
      title: 'Bloqueio LOTO · NR-12',
      items: [
        'Parada do equipamento pelo comando local confirmada?',
        'Cadeado e etiqueta individual por executante aplicados?',
        'Energias residuais dissipadas?',
        'Teste de tentativa de partida realizado?',
      ],
    },
  ],
};

// Bloco único de EPI da PET — vale para a permissão inteira, não é repetido
// por área de risco. Reduzido ao mínimo universal (o que qualquer
// intervenção usa); EPI específico de uma área ou operação — respirador
// autônomo, vestimenta antiarco, proteção pra solda — entra como item de
// checklist da própria área (já cobertos em CHECKLISTS.confinado, por
// exemplo) ou como item adicional cadastrado pela empresa, não aqui.
export const EPI_CHECKLIST: ChecklistGroup = {
  title: 'Equipamento de Proteção Individual (EPI)',
  items: [
    'Capacete com jugular?',
    'Óculos de segurança?',
    'Luvas de proteção adequadas à atividade?',
    'Calçado de segurança adequado à atividade?',
    'Todos os EPIs foram inspecionados e estão em condições de uso?',
  ],
};

// Trabalho a quente (NR-18) exigia vigia no local a cada 30 min por 2h
// após o término (04 rondas), conforme a PET em papel — mas NR-18 não é
// uma área de risco selecionável no momento (ver RiskAreaId), então nada
// aciona mais este tipo; mantido para quando o escopo crescer de novo.
export interface FireWatchRound {
  hora: string;
  nome: string;
}

export function emptyFireWatchRounds(): FireWatchRound[] {
  return [
    { hora: '', nome: '' },
    { hora: '', nome: '' },
    { hora: '', nome: '' },
    { hora: '', nome: '' },
  ];
}

export interface ChecklistGroupView {
  title: string;
  areaId: RiskAreaId | null;
  items: { key: string; label: string }[];
}

// Item de checklist que a própria empresa cadastra pra uma NR (aba
// "Checklist", ver PetChecklistItemsComponent) — o que CHECKLISTS não cobre
// porque é específico da operação de quem usa o sistema, não da norma em
// si. Chave da resposta é `custom:<id>` (não posicional): ao contrário dos
// itens fixos de CHECKLISTS, estes podem ser criados e excluídos a
// qualquer momento, e uma chave por índice (`<área>:<grupo>:<índice>`)
// desalinharia toda vez que a lista mudasse de tamanho.
export interface ChecklistCustomItem {
  id: string;
  riskAreaId: RiskAreaId;
  label: string;
}

// EPI (bloco único) seguido do checklist específico de cada área de risco
// selecionada — normas primeiro (mesma chave de sempre: "epi:0:<índice>" /
// "<área>:<grupo>:<índice>"), itens adicionais da empresa por último (chave
// "custom:<id>") — usado tanto pra renderizar a etapa "Checklist e foto"
// quanto pra reconstituir as respostas salvas no detalhe de uma PET já
// emitida.
export function buildChecklistGroups(
  areas: RiskAreaId[],
  customItems: ChecklistCustomItem[] = [],
): ChecklistGroupView[] {
  const epiGroup: ChecklistGroupView = {
    title: EPI_CHECKLIST.title,
    areaId: null,
    items: EPI_CHECKLIST.items.map((label, itemIndex) => ({
      key: `epi:0:${itemIndex}`,
      label,
    })),
  };
  const areaGroups = areas.flatMap((areaId) => {
    const fixedGroups = CHECKLISTS[areaId].map((group, groupIndex) => ({
      title: group.title,
      areaId,
      items: group.items.map((label, itemIndex) => ({
        key: `${areaId}:${groupIndex}:${itemIndex}`,
        label,
      })),
    }));
    const custom = customItems.filter((item) => item.riskAreaId === areaId);
    const customGroup: ChecklistGroupView[] =
      custom.length > 0
        ? [
            {
              title: `Itens adicionais da empresa · ${riskAreaNr(areaId)}`,
              areaId,
              items: custom.map((item) => ({
                key: `custom:${item.id}`,
                label: item.label,
              })),
            },
          ]
        : [];
    return [...fixedGroups, ...customGroup];
  });
  return [epiGroup, ...areaGroups];
}

export const AREA_NOTE: Record<RiskAreaId, string> = {
  confinado: 'Espaço confinado (NR-33): o fluxo inclui medição atmosférica contínua, vigia externo e plano de resgate antes da liberação.',
  altura: 'Trabalho em altura (NR-35): o fluxo exige ancoragem certificada, linha de vida testada e plano de resgate — sem etapa de medição atmosférica.',
  eletrico: 'Serviço elétrico (NR-10): o fluxo exige desenergização, teste de ausência de tensão e aterramento temporário registrados.',
  maquinas: 'Máquinas e bloqueio (NR-12): o fluxo exige cadeado individual por executante e teste de tentativa de partida.',
  descarga: 'Descarga de gases/líquidos (NR-20): o fluxo exige motorista capacitado (NR-20/MOPP), aterramento do caminhão e ausência de fontes de ignição na área.',
  naval: 'Indústria naval (NR-34): o fluxo inclui teste atmosférico (gás-livre) antes da entrada em tanques/porões e isolamento da frente de trabalho a bordo.',
  plataforma: 'Plataforma de petróleo (NR-37): o fluxo exige treinamento de sobrevivência (HUET) válido e detecção de gás antes de liberar a frente de trabalho.',
};

export type WizardStepId = 'metodo' | 'area' | 'atividade' | 'gases' | 'qr' | 'check' | 'sig';

export const STEP_NAME: Record<WizardStepId, string> = {
  metodo: 'Como cadastrar',
  area: 'Área de risco',
  atividade: 'Atividade e local',
  gases: 'Medição atmosférica',
  qr: 'Crachá e permissão',
  check: 'Checklist e foto',
  sig: 'Assinaturas',
};

export function stepsFor(ids: RiskAreaId[]): WizardStepId[] {
  return ['metodo', 'area', 'atividade', ...(requiresGasMonitoring(ids) ? (['gases'] as const) : []), 'qr', 'check', 'sig'];
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

export type PetStatus = 'aberta' | 'fechada' | 'ocorrencia' | 'alarme';

export const PET_STATUS: Record<PetStatus, { label: string; fg: string; bg: string }> = {
  aberta: { label: 'aberta', fg: '#1d4d33', bg: '#dff0e6' },
  alarme: { label: 'em alarme', fg: '#fdf3f3', bg: 'var(--status-bad)' },
  fechada: { label: 'encerrada', fg: 'var(--color-neutral-800)', bg: 'var(--color-neutral-200)' },
  ocorrencia: { label: 'ocorrência', fg: 'var(--status-bad)', bg: '#f6e3e3' },
};

/**
 * Situação exibida de uma PET.
 *
 * O alarme atmosférico só se sobrepõe ao status enquanto a permissão está
 * em vigor — é a mesma regra que `PetStateService.alarmedPets` já aplica
 * (`p.alarm && p.status !== 'fechada'`). Sem essa guarda, uma PET encerrada
 * durante um alarme continuava rotulada "em alarme" na lista, no histórico
 * e no relatório, como se ainda houvesse gente exposta na frente.
 */
export function petStatusView(pet: Pick<Pet, 'alarm' | 'status'>): { label: string; fg: string; bg: string } {
  const showAlarm = pet.alarm && pet.status !== 'fechada';
  return PET_STATUS[showAlarm ? 'alarme' : pet.status];
}

export interface GasReading {
  o2: number;
  co: number;
  h2s: number;
  lel: number;
}

// Registro de uma liberação com ressalva: um funcionário com documentação
// vencida foi admitido na equipe mesmo assim, sob decisão do técnico.
export interface CriticalAlert {
  employeeName: string;
  registration: string;
  documentName: string;
  message: string;
  timestamp: string;
}

// Cada medição atmosférica pós-emissão é digitada manualmente pelo técnico
// (sem sensor conectado) e fica registrada aqui para auditoria, além de
// substituir a leitura atual em `gas`.
export interface GasReadingEntry {
  time: string;
  text: string;
}

// Uma leitura manual fora do limite de segurança gera um registro próprio,
// distinto do log normal de medição — para não passar despercebida no
// histórico da PET.
export interface AtmosphereAlert {
  gas: GasKey;
  value: number;
  limitText: string;
  message: string;
  timestamp: string;
}

export type PetTeamRole = 'equipe' | 'vigia' | 'resgate';

export const PET_TEAM_ROLE_LABEL: Record<PetTeamRole, string> = {
  equipe: 'Equipe autorizada',
  vigia: 'Vigia',
  resgate: 'Resgatista',
};

// Quem foi liberado na PET, por papel — preenchido a partir da leitura de
// crachá na etapa "Crachá e permissão" do assistente.
export interface PetTeamMember {
  name: string;
  registration: string;
  role: string;
  petRole: PetTeamRole;
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
  criticalAlerts?: CriticalAlert[];
  readings?: GasReadingEntry[];
  atmosphereAlerts?: AtmosphereAlert[];
  team?: PetTeamMember[];
  companyPhone?: string;
  closeReason?: string;
  closedBy?: string;
  // Preenchidos na etapa "Atividade e local" do assistente — antes só
  // ficavam na tela e eram descartados ao emitir a PET.
  description?: string;
  serviceType?: string;
  executingCompany?: string;
  plannedStart?: string;
  plannedEnd?: string;
  // Respostas SIM/NÃO/NA da etapa "Checklist e foto" — ver
  // buildChecklistGroups() para reconstituir os grupos/rótulos a partir
  // das chaves.
  checklist?: Record<string, ChecklistAnswer>;
  fireWatchRounds?: FireWatchRound[];
}

export interface DayReading {
  total: number;
  outOfRange: number;
  isWeekend: boolean;
  iso: string;
  dayLabel: string;
  dayShort: string;
}

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

// Local cadastrado pela empresa, já com a área de risco padrão — permite
// ao técnico escolher um local conhecido no assistente "Nova PET" e ter a
// área de risco, o nome e a unidade preenchidos sozinhos.
export interface CompanyLocation {
  id: string;
  name: string;
  riskAreas: RiskAreaId[];
  unit: string;
}

// Membro da brigada de emergência: recebe SMS/WhatsApp quando o botão de
// evacuação é acionado (ver EvacuationApiService/PetStateService).
export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

export interface TeamMember {
  name: string;
  registration: string;
  role: string;
  company: string;
  unit: string;
  isThirdParty?: boolean;
  documents: Record<string, string>;
  // Usado para enviar o código de confirmação por SMS/WhatsApp na
  // assinatura eletrônica de PET. `pinHash` (crachá + PIN) nunca chega ao
  // front-end — ver toPublic() em TeamMembersController no back-end.
  phone?: string | null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round((new Date(y, m - 1, d).getTime() - startOfToday().getTime()) / 86400000);
}

function documentStatus(days: number): BadgeItemStatus {
  if (days < 0) return 'venc';
  if (days <= 30) return 'prox';
  return 'ok';
}

// Converte um funcionário do quadro (achado pela busca por texto) no mesmo
// formato de crachá que a leitura simulada produz — a etapa "Crachá e
// permissão" do assistente usa o resultado das duas origens do mesmo jeito
// dali em diante (preview, ressalva por documento vencido, "+ Equipe/
// Vigia/Resgatista").
export function teamMemberToBadge(member: TeamMember): Badge {
  const items: BadgeItem[] = Object.keys(member.documents)
    .map((code) => {
      const iso = member.documents[code];
      const days = daysUntil(iso);
      const status = documentStatus(days);
      const description = DOCUMENT_TYPES.find((d) => d.code === code)?.description ?? code;
      const value =
        days < 0 ? `vencido há ${-days} d` : days === 0 ? 'vence hoje' : `válido até ${dateToBr(iso)}`;
      return { name: `${code} · ${description}`, status, value };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  return {
    name: member.name,
    registration: member.registration,
    role: member.role,
    company: member.isThirdParty ? `${member.company} · terceiro` : member.company,
    items,
  };
}

// Conteúdo do QR do crachá — cadastro (Funcionários, ver PetTeamComponent)
// gera, assistente (etapa "Crachá e permissão") lê pela câmera e resolve de
// volta pro mesmo TeamMember por matrícula. Prefixo evita que a câmera
// aceite qualquer QR aleatório apontado por engano (um link, um Wi-Fi...)
// como se fosse um crachá.
const BADGE_QR_PREFIX = 'PETDIGITAL:MAT:';

export function encodeBadgeQr(registration: string): string {
  return `${BADGE_QR_PREFIX}${registration}`;
}

export function decodeBadgeQr(text: string): string | null {
  if (!text.startsWith(BADGE_QR_PREFIX)) return null;
  const registration = text.slice(BADGE_QR_PREFIX.length).trim();
  return registration.length > 0 ? registration : null;
}

export interface MonitorArchive {
  readingCount: number;
  range: Record<GasKey, [number, number, number]>;
  outOfRange: number;
}

// Resumo de monitoramento atmosférico de uma PET a partir do que foi
// realmente registrado: as medições são digitadas à mão (sem sensor), então
// cada entrada em `readings` é uma medição e cada `atmosphereAlerts` uma
// leitura fora do limite. Sem medição registrada, usa só a leitura atual.
export function buildMonitorArchive(pet: Pet): MonitorArchive {
  const gas = pet.gas ?? { o2: 0, co: 0, h2s: 0, lel: 0 };
  const point = (v: number): [number, number, number] => [v, v, v];
  return {
    readingCount: pet.readings?.length || (pet.gas ? 1 : 0),
    range: { o2: point(gas.o2), co: point(gas.co), h2s: point(gas.h2s), lel: point(gas.lel) },
    outOfRange: pet.atmosphereAlerts?.length ?? 0,
  };
}

const pad2 = (v: number) => String(v).padStart(2, '0');

// Medições dos últimos 30 dias (terminando hoje), somadas a partir das PETs
// reais — nada é sorteado: dia sem PET aparece zerado.
export function buildDailyReadings(pets: Pet[], days = 30): DayReading[] {
  const today = startOfToday();
  const out: DayReading[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const iso = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    const ofDay = pets.filter((p) => p.date === iso);
    out.push({
      total: ofDay.reduce((sum, p) => sum + buildMonitorArchive(p).readingCount, 0),
      outOfRange: ofDay.reduce((sum, p) => sum + buildMonitorArchive(p).outOfRange, 0),
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      iso,
      dayLabel: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
      dayShort: pad2(d.getDate()),
    });
  }
  return out;
}

export function todayIso(): string {
  const d = startOfToday();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
