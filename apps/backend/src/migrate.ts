/**
 * Executor de migrations.
 *
 * O schema deixou de nascer do `synchronize: true` do TypeORM e passou a ser
 * versionado em arquivos SQL numerados. A troca importa porque synchronize
 * compara entidade com banco e aplica a diferença sozinho: é prático no
 * começo e perigoso quando há dado real — ele pode remover coluna, e não
 * deixa histórico do que mudou nem como voltar atrás.
 *
 * Cada arquivo roda uma única vez, dentro de uma transação, e fica
 * registrado em `schema_migrations` com o checksum do conteúdo. Se um
 * arquivo já aplicado for editado depois, a execução para e avisa — schema
 * aplicado que muda por baixo é a origem clássica de "na minha máquina
 * funciona".
 *
 * Uso:
 *   npm run db:migrate          aplica o que falta
 *   npm run db:migrate -- --status   só mostra a situação
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import { config as loadEnv } from 'dotenv';

loadEnv();

const MIGRATIONS_DIR = join(__dirname, '..', 'migrations');

/**
 * Conexão a partir do ambiente, nunca de credencial escrita no código.
 * `DATABASE_URL` tem prioridade (é o formato que os serviços de hospedagem
 * entregam); as variáveis separadas cobrem o desenvolvimento local.
 */
function connectionConfig() {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    user: process.env.DB_USERNAME ?? 'petsystem',
    password: process.env.DB_PASSWORD ?? 'petsystem',
    database: process.env.DB_NAME ?? 'petsystem',
  };
}

interface MigrationFile {
  name: string;
  sql: string;
  checksum: string;
}

function loadMigrations(): MigrationFile[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    // Ordem alfabética sobre nomes numerados (001_, 002_…) é a ordem de
    // aplicação. Numerar é o que garante que a dependência entre uma
    // migration e outra seja respeitada.
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name), 'utf8');
      return {
        name,
        sql,
        checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16),
      };
    });
}

async function main(): Promise<void> {
  const somenteStatus = process.argv.includes('--status');
  const client = new Client(connectionConfig());
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       text PRIMARY KEY,
        checksum   text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    const aplicadas = new Map<string, string>(
      (
        await client.query<{ name: string; checksum: string }>(
          'SELECT name, checksum FROM schema_migrations',
        )
      ).rows.map((r) => [r.name, r.checksum]),
    );

    const migrations = loadMigrations();
    let aplicadasAgora = 0;

    for (const migration of migrations) {
      const jaAplicada = aplicadas.get(migration.name);

      if (jaAplicada) {
        if (jaAplicada !== migration.checksum) {
          throw new Error(
            `A migration ${migration.name} já foi aplicada, mas o arquivo mudou depois. ` +
              'Não altere migration aplicada — crie uma nova com a correção.',
          );
        }
        if (somenteStatus) console.log(`  ok       ${migration.name}`);
        continue;
      }

      if (somenteStatus) {
        console.log(`  pendente ${migration.name}`);
        continue;
      }

      process.stdout.write(`  aplicando ${migration.name} … `);
      // Transação por migration: ou o arquivo inteiro entra, ou nada dele
      // entra. Schema pela metade é pior que schema antigo.
      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)',
          [migration.name, migration.checksum],
        );
        await client.query('COMMIT');
        console.log('ok');
        aplicadasAgora++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.log('FALHOU');
        throw err;
      }
    }

    if (!somenteStatus) {
      console.log(
        aplicadasAgora === 0
          ? 'Banco já está atualizado.'
          : `${aplicadasAgora} migration(s) aplicada(s).`,
      );
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('\nMigration falhou:', err instanceof Error ? err.message : err);
  process.exit(1);
});
