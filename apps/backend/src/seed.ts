import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { UsersService } from './app/users/users.service';

const SEED_USERS = [
  {
    name: 'Default Doorkeeper',
    email: 'porteiro@petsystem.local',
    password: 'senha123',
    role: 'porteiro',
    accessLevel: 5,
    qrCode: 'QR-PORTEIRO-001',
  },
  {
    name: 'João Silva',
    email: 'joao.silva@petsystem.local',
    password: 'senha123',
    role: 'funcionario',
    accessLevel: 3,
    qrCode: 'QR-FUNC-AUTORIZADO',
  },
  {
    name: 'Maria Souza',
    email: 'maria.souza@petsystem.local',
    password: 'senha123',
    role: 'estagiario',
    accessLevel: 1,
    qrCode: 'QR-ESTAGIARIO-NEGADO',
  },
];

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);

  for (const data of SEED_USERS) {
    const existing = await usersService.findByEmail(data.email);
    if (existing) {
      Logger.log(`User already exists, skipping: ${data.email}`);
      continue;
    }
    await usersService.create(data);
    Logger.log(`User created: ${data.email} (level ${data.accessLevel})`);
  }

  await app.close();
}

seed().catch((err) => {
  Logger.error('Failed to seed test users', err);
  process.exit(1);
});
