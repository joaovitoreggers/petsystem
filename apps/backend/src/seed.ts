import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { EmployeesService } from './app/employees/employees.service';
import { UsersService } from './app/users/users.service';

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

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const employeesService = app.get(EmployeesService);

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

  await app.close();
}

seed().catch((err) => {
  Logger.error('Failed to seed test data', err);
  process.exit(1);
});
