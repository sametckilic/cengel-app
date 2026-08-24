import { Inject, Injectable, type OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import type { ApiEnvironment } from '../config/environment';
import * as schema from './schema';

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly db: NodePgDatabase<typeof schema>;
  private readonly pool: Pool;

  constructor(
    @Inject(ConfigService)
    config: ConfigService<ApiEnvironment, true>,
  ) {
    this.pool = new Pool({
      connectionString: config.get('DATABASE_URL', { infer: true }),
      connectionTimeoutMillis: config.get('DB_CONNECTION_TIMEOUT_MS', {
        infer: true,
      }),
      max: config.get('DB_POOL_MAX', { infer: true }),
      ssl: config.get('DATABASE_SSL', { infer: true })
        ? { rejectUnauthorized: false }
        : undefined,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async ping(): Promise<void> {
    await this.db.execute(sql`select 1`);
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
