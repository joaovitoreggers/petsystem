import { execSync } from 'node:child_process';
import { Client } from 'pg';

/**
 * Jest globalSetup: garante que o banco de teste dedicado existe antes de
 * qualquer suíte de integração rodar. Roda uma vez, no processo principal
 * do Jest — antes dos workers, então lê `process.env` diretamente (setado
 * pelo script npm que invoca este config, ver package.json).
 *
 * Postgres não tem `CREATE DATABASE IF NOT EXISTS`; e não dá para criar um
 * banco estando conectado nele, então conecta no banco `postgres` padrão
 * primeiro.
 *
 * Criado o banco, aplica as migrations nele. Antes o schema aparecia sozinho
 * porque o TypeORM rodava com `synchronize: true`; agora o schema é
 * versionado em SQL (ver migrate.ts) e o banco de teste nasce vazio. Rodar as
 * mesmas migrations do banco de verdade é o que faz o teste de integração
 * valer: ele passa a exercitar o schema que vai para produção, e uma
 * migration esquecida quebra aqui em vez de quebrar lá.
 */
module.exports = async function setupTestDatabase(): Promise<void> {
  const dbName = process.env.DB_NAME ?? 'petsystem_test';
  const client = new Client({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '55432'),
    user: process.env.DB_USERNAME ?? 'petsystem',
    password: process.env.DB_PASSWORD ?? 'petsystem',
    database: 'postgres',
  });

  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
    }
  } finally {
    await client.end();
  }

  // Processo separado de propósito: migrate.ts é um CLI que termina com
  // process.exit em caso de falha — importá-lo aqui derrubaria o Jest
  // inteiro sem dizer o porquê. `stdio: 'inherit'` deixa o erro da
  // migration aparecer como ele é.
  execSync('npm run db:migrate', {
    stdio: 'inherit',
    env: {
      ...process.env,
      DB_NAME: dbName,
      // DATABASE_URL de um banco de desenvolvimento apontaria a migration
      // para o banco errado: aqui só valem as variáveis separadas.
      DATABASE_URL: '',
    },
  });
};
