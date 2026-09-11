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
};
