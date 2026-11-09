import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { BranchesService } from './app/tenancy/branches.service';
import { CompanyGroupsService } from './app/tenancy/company-groups.service';
import { EmployeesService } from './app/employees/employees.service';
import { WorkPermitsService } from './app/work-permits/work-permits.service';
import { TeamMembersService } from './app/team-members/team-members.service';
import { CompanyLocationsService } from './app/company-locations/company-locations.service';
import { EmergencyContactsService } from './app/emergency-contacts/emergency-contacts.service';
import { ChecklistItemsService } from './app/checklist-items/checklist-items.service';

/**
 * Carga em massa de registros realistas (N de cada tipo) em UMA empresa já
 * existente. Uso:
 *
 *   BULK_COMPANY_GROUP="Nome da empresa" npm run backend:seed-bulk
 *
 * Variáveis:
 *   BULK_COMPANY_GROUP  nome exato do grupo de empresas (obrigatório).
 *   BULK_COUNT          quantos de cada tipo (padrão 50).
 *   BULK_CONFIRM=yes    exigido quando NODE_ENV=production — a carga grava
 *                       dados de teste no banco apontado pelo DB_*.
 *
 * Idempotente: usa chaves determinísticas (matrículas 9xxxx, PET-BULK-xxxx,
 * nomes numerados) e pula o que já existe — rodar duas vezes não duplica.
 * Todos os funcionários do quadro recebem o mesmo telefone (BULK_MEMBER_PHONE,
 * padrão +5545999894283), inclusive os já criados em execuções anteriores.
 * Os telefones dos contatos da brigada são propositalmente inválidos (sem o 9 do
 * celular): se o Twilio estiver configurado, o envio falha em vez de
 * mandar SMS para uma pessoa de verdade.
 */

const COUNT = Number(process.env.BULK_COUNT ?? 50);
// Telefone de todos os funcionários do quadro (recebe o código de assinatura).
const MEMBER_PHONE = process.env.BULK_MEMBER_PHONE ?? '+5545999894283';
const RISK_AREAS = ['confinado', 'altura', 'eletrico', 'maquinas', 'descarga', 'naval', 'plataforma'] as const;
type RiskArea = (typeof RISK_AREAS)[number];

const FIRST_NAMES = [
  'João', 'Marcos', 'Patrícia', 'Adriana', 'Rafael', 'Simone', 'Diego', 'Elaine', 'Vilmar', 'Éder',
  'Cleiton', 'Alan', 'Jonas', 'Bárbara', 'Luciana', 'Ricardo', 'Fernanda', 'Gustavo', 'Camila', 'Anderson',
];
const LAST_NAMES = [
  'Ferreira', 'Lima', 'Alves', 'Beal', 'Hoffmann', 'Bertoldi', 'Ostrovski', 'Sobczak', 'Radaelli', 'Vasconcelos',
  'Kirchner', 'Wolff', 'Kuhn', 'Menegat', 'Schmitt', 'Pereira', 'Zanella', 'Bonfanti', 'Dallagnol', 'Tomazi',
];
const TEAM_ROLES = [
  'Mecânico industrial', 'Eletricista', 'Operador de silo · vigia', 'Soldador · vigia de fogo',
  'Operadora de ETE', 'Caldeireira', 'Auxiliar de manutenção', 'Montador industrial', 'Téc. Segurança do Trabalho',
];
const EMPLOYEE_ROLES = ['tecnico_seguranca', 'operador_de_campo', 'estagiaria', 'mecanico', 'eletricista'];
const COMPANIES = [
  { name: 'Manutenção', thirdParty: false },
  { name: 'Armazéns', thirdParty: false },
  { name: 'Utilidades', thirdParty: false },
  { name: 'SESMT', thirdParty: false },
  { name: 'Termoeletro Ltda', thirdParty: true },
  { name: 'Altura Serviços ME', thirdParty: true },
];
// NRs exigidas por área (mesma ideia do front: confinado=NR-33, altura=NR-35...).
const AREA_NR: Record<RiskArea, string> = {
  confinado: 'NR-33', altura: 'NR-35', eletrico: 'NR-10', maquinas: 'NR-12',
  descarga: 'NR-20', naval: 'NR-34', plataforma: 'NR-37',
};
const LOCATION_BASES: { name: string; areas: RiskArea[] }[] = [
  { name: 'Silo de milho', areas: ['confinado'] },
  { name: 'Silo de soja', areas: ['confinado'] },
  { name: 'Elevatória da ETE', areas: ['confinado', 'eletrico'] },
  { name: 'Casa de caldeiras', areas: ['confinado', 'altura'] },
  { name: 'Túnel de congelamento', areas: ['eletrico', 'maquinas'] },
  { name: 'Torre de resfriamento', areas: ['altura'] },
  { name: 'Moega de recebimento', areas: ['confinado'] },
  { name: 'Linha de extrusão', areas: ['maquinas'] },
  { name: 'Oficina de manutenção', areas: ['maquinas'] },
  { name: 'Tanque de efluente', areas: ['confinado', 'maquinas'] },
  { name: 'Subestação — pórtico', areas: ['altura', 'eletrico'] },
  { name: 'Linha de abate — nória', areas: ['maquinas'] },
  { name: 'Plataforma de descarga', areas: ['descarga'] },
  { name: 'Píer de carregamento', areas: ['naval'] },
  { name: 'Plataforma elevatória', areas: ['plataforma', 'altura'] },
];
const SERVICE_TYPES = ['Manutenção corretiva', 'Manutenção preventiva', 'Limpeza', 'Inspeção', 'Troca de componente'];
const CHECKLIST_LABELS: Record<RiskArea, string[]> = {
  confinado: [
    'Espaço identificado com placa de numeração atualizada?',
    'Ventilação forçada instalada antes da entrada?',
    'Equipamento de resgate posicionado na entrada?',
    'Fontes de energia do equipamento bloqueadas (LOTO)?',
    'Comunicação entre vigia e entrante testada?',
    'Detector de gases calibrado dentro da validade?',
    'Iluminação à prova de explosão disponível?',
  ],
  altura: [
    'Talabarte duplo (Y) disponível para troca de ponto de ancoragem?',
    'Linha de vida inspecionada antes do uso?',
    'Área abaixo do serviço isolada e sinalizada?',
    'Condições climáticas verificadas antes da subida?',
    'Ferramentas presas ao corpo ou com cordão de segurança?',
    'Cinto com certificado e inspeção em dia?',
    'Ponto de ancoragem com resistência comprovada?',
  ],
  eletrico: [
    'Circuito desenergizado e bloqueado com cadeado e etiqueta?',
    'Ausência de tensão confirmada com instrumento testado?',
    'Aterramento temporário instalado?',
    'EPI dielétrico dentro do prazo de ensaio?',
    'Área de trabalho delimitada e sinalizada?',
    'Diagrama unifilar atualizado conferido?',
    'Ferramentas isoladas inspecionadas?',
  ],
  maquinas: [
    'Máquina parada e bloqueada em todos os pontos de energia?',
    'Energia residual (pneumática/hidráulica) descarregada?',
    'Proteções fixas e móveis recolocadas ao término?',
    'Aviso de equipamento em manutenção afixado?',
    'Ferramentas retiradas do interior da máquina?',
    'Equipe de operação avisada antes do religamento?',
    'Teste de parada de emergência realizado?',
  ],
  descarga: [
    'Aterramento do veículo conectado antes da descarga?',
    'Mangueiras inspecionadas e com acoplamentos íntegros?',
    'Bacia de contenção sem acúmulo de líquido?',
    'Extintores posicionados e dentro da validade?',
    'Chuveiro lava-olhos testado no dia?',
    'Fonte de ignição afastada do ponto de descarga?',
    'Ficha de emergência do produto disponível?',
  ],
  naval: [
    'Atmosfera do compartimento medida antes da entrada?',
    'Trabalho a quente com vigia de fogo designado?',
    'Equipe com treinamento específico em NR-34 comprovado?',
    'Rota de fuga desobstruída e sinalizada?',
    'Equipamento de içamento de resgate disponível?',
    'Isolamento de linhas e válvulas confirmado?',
    'Permissão da fiscalização da embarcação anexada?',
  ],
  plataforma: [
    'Plataforma inspecionada conforme manual do fabricante?',
    'Guarda-corpo e rodapé íntegros?',
    'Área de movimentação isolada no nível do solo?',
    'Comandos de emergência testados?',
    'Capacidade de carga respeitada e sinalizada?',
    'Estabilizadores apoiados em piso firme?',
    'Operador habilitado com autorização vigente?',
  ],
};

const pad = (v: number, size = 2) => String(v).padStart(size, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
const hhmm = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

function personName(i: number): string {
  return `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[Math.floor(i / FIRST_NAMES.length) % LAST_NAMES.length]}`;
}

function timeLabelFor(date: Date, today: Date, start: string): string {
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return start;
  if (diff === 1) return 'ontem';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

async function run() {
  const groupName = process.env.BULK_COMPANY_GROUP;
  if (!groupName) {
    throw new Error('Defina BULK_COMPANY_GROUP com o nome exato do grupo de empresas.');
  }
  if (process.env.NODE_ENV === 'production' && process.env.BULK_CONFIRM !== 'yes') {
    throw new Error('NODE_ENV=production: defina BULK_CONFIRM=yes para confirmar a carga de dados de teste.');
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const groups = await app.get(CompanyGroupsService).findAll();
    const group = groups.find((g) => g.name === groupName);
    if (!group) {
      throw new Error(
        `Grupo "${groupName}" não encontrado. Disponíveis: ${groups.map((g) => g.name).join(', ') || '(nenhum)'}`,
      );
    }
    const branches = await app.get(BranchesService).findByCompanyGroup(group.id);
    const branchNames = branches.map((b) => b.name);
    const branchIdByName = new Map(branches.map((b) => [b.name, b.id]));
    const unitFor = (i: number) => (branchNames.length ? branchNames[i % branchNames.length] : 'Unidade única');
    const branchIdFor = (unit: string) => branchIdByName.get(unit) ?? null;
    Logger.log(`Grupo: ${group.name} · filiais: ${branchNames.length ? branchNames.join(', ') : '(nenhuma)'} · ${COUNT} de cada tipo`);

    const today = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    const created: Record<string, number> = {};
    const bump = (k: string) => (created[k] = (created[k] ?? 0) + 1);
    const scopeAll = { role: 'platform-admin' as const, companyGroupId: null, branchId: null };

    // 1) Locais
    const locationsSvc = app.get(CompanyLocationsService);
    const existingLocations = new Set((await locationsSvc.findAll(scopeAll)).map((l) => l.name));
    const locationNames: { name: string; unit: string; areas: RiskArea[] }[] = [];
    for (let i = 0; i < COUNT; i++) {
      const base = LOCATION_BASES[i % LOCATION_BASES.length];
      const unit = unitFor(i);
      const name = `${base.name} ${pad(Math.floor(i / LOCATION_BASES.length) + 1)}`;
      locationNames.push({ name, unit, areas: base.areas });
      if (existingLocations.has(name)) continue;
      await locationsSvc.create({
        name, riskAreas: base.areas, unit, companyGroupId: group.id, branchId: branchIdFor(unit),
      } as never);
      bump('locais');
    }

    // 2) Funcionários cadastrados (quadro de equipe, com NRs e crachá)
    const membersSvc = app.get(TeamMembersService);
    const members: { name: string; registration: string; role: string }[] = [];
    for (let i = 0; i < COUNT; i++) {
      const registration = `9${pad(i + 1, 4)}`;
      const name = personName(i);
      const role = TEAM_ROLES[i % TEAM_ROLES.length];
      const company = COMPANIES[i % COMPANIES.length];
      const unit = unitFor(i);
      members.push({ name, registration, role });
      const existingMember = await membersSvc.findByRegistration(registration);
      if (existingMember) {
        if (existingMember.phone !== MEMBER_PHONE) {
          await membersSvc.update(registration, { phone: MEMBER_PHONE } as never);
          bump('telefones atualizados');
        }
        continue;
      }
      // Validades espalhadas: ~60% em dia, ~25% vencendo em até 30 dias, ~15% vencidas.
      const bucket = i % 20;
      const offset = bucket < 12 ? 120 + (i % 9) * 40 : bucket < 17 ? 5 + (i % 6) * 4 : -(10 + (i % 7) * 15);
      const area = RISK_AREAS[i % 4];
      const documents: Record<string, string> = {
        ASO: iso(addDays(today, 200 + (i % 10) * 20)),
        [AREA_NR[area]]: iso(addDays(today, offset)),
      };
      if (i % 3 === 0) documents['NR-35'] = iso(addDays(today, offset + 60));
      await membersSvc.create({
        name, registration, role,
        company: company.thirdParty ? company.name : `Empresa · ${company.name}`,
        unit,
        isThirdParty: company.thirdParty,
        documents,
        phone: MEMBER_PHONE,
        companyGroupId: group.id,
        branchId: branchIdFor(unit),
      } as never);
      bump('funcionários (quadro)');
    }

    // 3) Funcionários de acesso (validados por QR)
    const employeesSvc = app.get(EmployeesService);
    const existingEmployees = new Set((await employeesSvc.findAll(scopeAll)).map((e) => e.name));
    for (let i = 0; i < COUNT; i++) {
      const name = `${personName(i + 7)} (acesso)`;
      if (existingEmployees.has(name)) continue;
      await employeesSvc.create({
        name,
        role: EMPLOYEE_ROLES[i % EMPLOYEE_ROLES.length],
        canAccessRiskAreas: i % 3 !== 2,
        canPerformCorrectiveService: i % 3 === 0,
        companyGroupId: group.id,
      } as never);
      bump('funcionários (acesso QR)');
    }

    // 4) Contatos da brigada (telefones inválidos de propósito — ver topo)
    const contactsSvc = app.get(EmergencyContactsService);
    const existingContacts = new Set((await contactsSvc.findAll(scopeAll)).map((c) => c.name));
    for (let i = 0; i < COUNT; i++) {
      const name = `${personName(i + 3)} · Brigada ${pad(i + 1)}`;
      if (existingContacts.has(name)) continue;
      await contactsSvc.create({
        name,
        phone: `+5545${pad(i + 1, 9)}`,
        companyGroupId: group.id,
      } as never);
      bump('contatos da brigada');
    }

    // 5) Itens extras de checklist (rodízio entre as áreas)
    const checklistSvc = app.get(ChecklistItemsService);
    const existingItems = new Set((await checklistSvc.findAll(scopeAll)).map((c) => `${c.riskAreaId}|${c.label}`));
    for (let i = 0; i < COUNT; i++) {
      const area = RISK_AREAS[i % RISK_AREAS.length];
      const labels = CHECKLIST_LABELS[area];
      const label = labels[Math.floor(i / RISK_AREAS.length) % labels.length];
      if (existingItems.has(`${area}|${label}`)) continue;
      await checklistSvc.create({ riskAreaId: area, label, companyGroupId: group.id } as never);
      existingItems.add(`${area}|${label}`);
      bump('itens de checklist');
    }

    // 6) PETs — passado recente, com mistura de status e leituras de gás reais
    const permitsSvc = app.get(WorkPermitsService);
    for (let i = 0; i < COUNT; i++) {
      const id = `PET-BULK-${pad(i + 1, 4)}`;
      if (await permitsSvc.findById(id)) continue;
      const loc = locationNames[i % locationNames.length];
      const areas = loc.areas;
      const date = addDays(today, -Math.floor((i * 60) / COUNT));
      const startMin = 7 * 60 + ((i * 37) % 600);
      const start = hhmm(startMin);
      const slot = i % 10;
      // 7 fechadas, 1 ocorrência, 1 em alarme (aberta), 1 aberta — só hoje/ontem ficam abertas.
      const open = i < 2;
      const status = open ? 'aberta' : slot === 0 ? 'ocorrencia' : 'fechada';
      const duration = 25 + ((i * 53) % 260);
      const gasOk = { o2: 20.6 + (i % 4) * 0.1, co: (i * 3) % 12, h2s: (i % 5) * 0.2, lel: i % 4 };
      const alarm = open && i === 1;
      const gas = alarm ? { o2: 20.1, co: 6, h2s: 11.4, lel: 3 } : gasOk;
      const teamSize = 2 + (i % 4);
      const unit = loc.unit;
      await permitsSvc.create({
        id,
        areas,
        location: `${loc.name} · ${unit}`,
        unit,
        teamSize,
        date: iso(open ? today : date),
        start,
        end: open ? '' : hhmm(startMin + duration),
        timeLabel: timeLabelFor(open ? today : date, today, start),
        technician: personName(i + 11),
        status,
        coordinates: open ? `-25.${2500 + i}, -53.${9900 - i}` : '',
        gas: areas.some((a) => a === 'confinado') ? gas : undefined,
        alarm,
        durationMinutes: open ? undefined : duration,
        serviceType: SERVICE_TYPES[i % SERVICE_TYPES.length],
        description: `${SERVICE_TYPES[i % SERVICE_TYPES.length]} em ${loc.name}.`,
        executingCompany: COMPANIES[i % COMPANIES.length].name,
        team: members.slice(i % (COUNT - 3), (i % (COUNT - 3)) + Math.min(teamSize, 3)).map((m, k) => ({
          name: m.name, registration: m.registration, role: m.role,
          petRole: k === 0 ? 'equipe' : k === 1 ? 'vigia' : 'resgate',
        })),
        ...(status === 'ocorrencia' ? { closeReason: 'Leitura de LEL acima do limite durante o serviço; equipe evacuada e serviço reprogramado.' } : {}),
        companyGroupId: group.id,
        branchId: branchIdFor(unit),
      } as never);
      bump('PETs');
    }

    Logger.log(`Concluído. Criados: ${JSON.stringify(created)} (o que já existia foi ignorado).`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  Logger.error(`Falha na carga em massa: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
