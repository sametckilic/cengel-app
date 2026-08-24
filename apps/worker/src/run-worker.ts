import {
  addDaysToIsoDate,
  createScheduledDailyPublication,
  getDateKeyInTimeZone,
} from '@cengel/generator/daily-puzzle-schedule';
import { Pool } from 'pg';

import { loadCurrentCatalog } from './catalog';
import type { WorkerEnvironment } from './config';
import {
  compareShadowPublication,
  readReferencePublication,
  type ShadowComparison,
} from './shadow';

const LOCK_NAME = 'cengel:daily-puzzle-worker';

function resolveStartDate(value: WorkerEnvironment['WORKER_START_DATE']): string {
  const today = getDateKeyInTimeZone();

  if (value === 'today') {
    return today;
  }

  if (value === 'tomorrow') {
    return addDaysToIsoDate(today, 1);
  }

  return value;
}

export type ShadowRunSummary = {
  catalogVersionId: string;
  comparisons: ShadowComparison[];
  mode: 'shadow';
};

export async function runWorker(
  environment: WorkerEnvironment,
): Promise<ShadowRunSummary> {
  const pool = new Pool({
    connectionString: environment.DATABASE_URL,
    connectionTimeoutMillis: environment.DB_CONNECTION_TIMEOUT_MS,
    max: environment.DB_POOL_MAX,
    ssl: environment.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();
  let lockAcquired = false;

  try {
    const lockResult = await client.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_lock(hashtext($1)) AS acquired',
      [LOCK_NAME],
    );
    lockAcquired = lockResult.rows[0]?.acquired === true;

    if (!lockAcquired) {
      throw new Error('Another daily puzzle worker already holds the generation lock.');
    }

    const catalogSnapshot = await loadCurrentCatalog(client);
    const startDate = resolveStartDate(environment.WORKER_START_DATE);
    const comparisons: ShadowComparison[] = [];

    for (let offset = 0; offset < environment.WORKER_BUFFER_DAYS; offset += 1) {
      const date = addDaysToIsoDate(startDate, offset);
      const publication = createScheduledDailyPublication(
        catalogSnapshot.catalog,
        { date, revision: environment.WORKER_REVISION },
      );
      const reference = await readReferencePublication(date);
      comparisons.push(compareShadowPublication(publication, reference));
    }

    const mismatches = comparisons.filter(
      (comparison) => comparison.status === 'mismatch',
    );

    if (mismatches.length > 0) {
      throw new Error(
        `Shadow generation mismatched ${mismatches.length} reference publication(s): ` +
          mismatches.map(({ date }) => date).join(', '),
      );
    }

    return {
      catalogVersionId: catalogSnapshot.catalogVersionId,
      comparisons,
      mode: 'shadow',
    };
  } finally {
    if (lockAcquired) {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]);
    }

    client.release();
    await pool.end();
  }
}
