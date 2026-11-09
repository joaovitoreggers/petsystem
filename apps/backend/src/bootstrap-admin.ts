import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import { UsersService } from './app/users/users.service';

// Cria (uma única vez) o administrador da plataforma de um ambiente novo —
// por exemplo, o primeiro deploy em produção. Ao contrário do `seed.ts`, não
// carrega dados de demonstração nem senhas fixas: e-mail e senha vêm do
// ambiente, e rodar de novo é inofensivo (se o e-mail já existe, nada muda).
//
//   ADMIN_EMAIL=voce@empresa.com ADMIN_PASSWORD='uma-senha-forte' \
//     npm run backend:bootstrap-admin
const MIN_PASSWORD_LENGTH = 12;

async function bootstrapAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `ADMIN_PASSWORD precisa ter ao menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  try {
    const usersService = app.get(UsersService);
    if (await usersService.findByEmail(email)) {
      Logger.log(`Usuário já existe, nada a fazer: ${email}`);
      return;
    }
    await usersService.create({
      name: process.env.ADMIN_NAME?.trim() || 'Administrador',
      email,
      password,
      role: 'platform-admin',
    });
    Logger.log(`Administrador da plataforma criado: ${email}`);
  } finally {
    await app.close();
  }
}

bootstrapAdmin().catch((err) => {
  Logger.error(`Falha ao criar o administrador: ${err.message}`);
  process.exit(1);
});
