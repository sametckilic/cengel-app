import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import path from 'node:path';

import { validateEnvironment } from '../config/environment';

async function runMigrations(): Promise<void> {
  const config = validateEnvironment(process.env);
  const pool = new Pool({
    connectionString: config.DATABASE_URL,
    connectionTimeoutMillis: config.DB_CONNECTION_TIMEOUT_MS,
    max: config.DB_POOL_MAX,
    ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await migrate(drizzle(pool), {
      migrationsFolder: path.resolve(__dirname, '../../drizzle'),
    });
  } finally {
    await pool.end();
  }
}

void runMigrations();
