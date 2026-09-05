import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { EmployeesService } from './app/employees/employees.service';
import { UsersService } from './app/users/users.service';
import { WorkPermitsService } from './app/work-permits/work-permits.service';
import { TeamMembersService } from './app/team-members/team-members.service';

const SEED_USERS = [
  {
    name: 'Default Doorkeeper',
    email: 'porteiro@petsystem.local',
    password: 'senha123',
    role: 'porteiro',
  },
  {
    name: 'Operador Backup',
    email: 'operador@petsystem.local',
    password: 'senha123',
    role: 'operador',
  },
];

// Funcionários de campo — validados pelo QrValidationModule, não fazem
// login. As duas permissões são independentes uma da outra (ver o exemplo
// abaixo: cada combinação relevante aparece pelo menos uma vez).
const SEED_EMPLOYEES = [
  {
    name: 'João Ferreira',
    role: 'tecnico_seguranca',
    canAccessRiskAreas: true,
    canPerformCorrectiveService: true,
  },
  {
    name: 'Marcos Lima',
    role: 'operador_de_campo',
    canAccessRiskAreas: true,
    canPerformCorrectiveService: false,
  },
  {
    name: 'Patricia Alves',
    role: 'estagiaria',
    canAccessRiskAreas: false,
    canPerformCorrectiveService: false,
  },
];

// Mesmos dados que já apareciam mockados no front-end (apps/frontend/src/app/pet/pet-mock-data.ts)
// — viram o estado inicial do banco para que a tela não mude visualmente ao trocar o mock local
// pela chamada real à API.
const SEED_WORK_PERMITS = [
  { id: 'PET-2026-0418', areas: ['confinado'], location: 'Silo de milho 04 · Matelândia', unit: 'Matelândia', teamSize: 3, date: '2026-09-05', start: '09:42', end: '', timeLabel: '09:42', technician: 'B. Garlini', status: 'aberta' as const, coordinates: '-25.2531, -53.9927', gas: { o2: 20.8, co: 2, h2s: 0.2, lel: 1 } },
  { id: 'PET-2026-0417', areas: ['confinado', 'eletrico'], location: 'Elevatória da ETE · Medianeira', unit: 'Medianeira', teamSize: 2, date: '2026-09-05', start: '08:15', end: '', timeLabel: '08:15', technician: 'R. Hoffmann', status: 'aberta' as const, coordinates: '-25.2952, -54.0940', gas: { o2: 20.1, co: 6, h2s: 11.4, lel: 3 }, alarm: true },
  { id: 'PET-2026-0416', areas: ['quente', 'altura'], location: 'Casa de caldeiras 02 · Matelândia', unit: 'Matelândia', teamSize: 4, date: '2026-09-05', start: '07:30', end: '', timeLabel: '07:30', technician: 'B. Garlini', status: 'aberta' as const, coordinates: '-25.2540, -53.9911', gas: { o2: 20.9, co: 14, h2s: 0, lel: 4 } },
  { id: 'PET-2026-0415', areas: ['eletrico', 'maquinas'], location: 'Túnel de congelamento · Matelândia', unit: 'Matelândia', teamSize: 2, date: '2026-09-04', start: '13:20', end: '15:30', timeLabel: 'ontem', technician: 'B. Garlini', status: 'fechada' as const, coordinates: '', durationMinutes: 130 },
  { id: 'PET-2026-0414', areas: ['altura'], location: 'Torre de resfriamento · Céu Azul', unit: 'Céu Azul', teamSize: 3, date: '2026-09-04', start: '08:05', end: '12:40', timeLabel: 'ontem', technician: 'A. Beal', status: 'fechada' as const, coordinates: '', durationMinutes: 275 },
  { id: 'PET-2026-0412', areas: ['confinado', 'quente'], location: 'Moega de recebimento 01 · Missal', unit: 'Missal', teamSize: 5, date: '2026-09-02', start: '14:10', end: '14:36', timeLabel: '02/09', technician: 'A. Beal', status: 'ocorrencia' as const, coordinates: '', durationMinutes: 26 },
  { id: 'PET-2026-0410', areas: ['maquinas'], location: 'Linha de extrusão · Itaipulândia', unit: 'Itaipulândia', teamSize: 2, date: '2026-09-01', start: '09:00', end: '10:48', timeLabel: '01/09', technician: 'R. Hoffmann', status: 'fechada' as const, coordinates: '', durationMinutes: 108 },
  { id: 'PET-2026-0409', areas: ['confinado'], location: 'Silo de soja 09 · Itaipulândia', unit: 'Itaipulândia', teamSize: 4, date: '2026-08-31', start: '07:15', end: '11:05', timeLabel: '31/08', technician: 'R. Hoffmann', status: 'fechada' as const, coordinates: '', durationMinutes: 230 },
  { id: 'PET-2026-0405', areas: ['quente'], location: 'Oficina de manutenção · Matelândia', unit: 'Matelândia', teamSize: 2, date: '2026-08-28', start: '13:40', end: '16:10', timeLabel: '28/08', technician: 'B. Garlini', status: 'fechada' as const, coordinates: '', durationMinutes: 150 },
  { id: 'PET-2026-0398', areas: ['confinado', 'maquinas'], location: 'Tanque de efluente 02 · Medianeira', unit: 'Medianeira', teamSize: 3, date: '2026-08-27', start: '08:30', end: '08:52', timeLabel: '27/08', technician: 'A. Beal', status: 'ocorrencia' as const, coordinates: '', durationMinutes: 22 },
  { id: 'PET-2026-0392', areas: ['altura', 'eletrico'], location: 'Subestação — pórtico 1 · Céu Azul', unit: 'Céu Azul', teamSize: 3, date: '2026-08-22', start: '07:50', end: '12:20', timeLabel: '22/08', technician: 'R. Hoffmann', status: 'fechada' as const, coordinates: '', durationMinutes: 270 },
  { id: 'PET-2026-0385', areas: ['maquinas'], location: 'Linha de abate — nória · Matelândia', unit: 'Matelândia', teamSize: 2, date: '2026-08-18', start: '15:10', end: '17:25', timeLabel: '18/08', technician: 'B. Garlini', status: 'fechada' as const, coordinates: '', durationMinutes: 135 },
];

const SEED_TEAM_MEMBERS = [
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

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const employeesService = app.get(EmployeesService);
  const workPermitsService = app.get(WorkPermitsService);
  const teamMembersService = app.get(TeamMembersService);

  for (const data of SEED_USERS) {
    const existing = await usersService.findByEmail(data.email);
    if (existing) {
      Logger.log(`User already exists, skipping: ${data.email}`);
      continue;
    }
    await usersService.create(data);
    Logger.log(`User created: ${data.email}`);
  }

  for (const data of SEED_EMPLOYEES) {
    const existingAll = await employeesService.findAll();
    const existing = existingAll.find((employee) => employee.name === data.name);
    if (existing) {
      Logger.log(`Employee already exists, skipping: ${data.name} (id/qrCode: ${existing.id})`);
      continue;
    }
    const employee = await employeesService.create(data);
    Logger.log(
      `Employee created: ${data.name} (canAccessRiskAreas=${data.canAccessRiskAreas}, canPerformCorrectiveService=${data.canPerformCorrectiveService}, id/qrCode: ${employee.id})`,
    );
  }

  for (const data of SEED_WORK_PERMITS) {
    const existing = await workPermitsService.findById(data.id);
    if (existing) {
      Logger.log(`Work permit already exists, skipping: ${data.id}`);
      continue;
    }
    await workPermitsService.create(data);
    Logger.log(`Work permit created: ${data.id}`);
  }

  for (const data of SEED_TEAM_MEMBERS) {
    const existing = await teamMembersService.findByRegistration(data.registration);
    if (existing) {
      Logger.log(`Team member already exists, skipping: ${data.name} (mat. ${data.registration})`);
      continue;
    }
    await teamMembersService.create(data);
    Logger.log(`Team member created: ${data.name} (mat. ${data.registration})`);
  }

  await app.close();
}

seed().catch((err) => {
  Logger.error('Failed to seed test data', err);
  process.exit(1);
});
