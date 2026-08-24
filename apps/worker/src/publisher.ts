import { createHash } from 'node:crypto';

import type { PoolClient, QueryResultRow } from 'pg';

import type { CatalogSnapshot, DailyPublication } from './types';

type PublishedPuzzleRow = QueryResultRow & {
  checksum: string;
  puzzle_id: string;
  record_id: string;
  version: number;
};

type PuzzleVersionRow = QueryResultRow & {
  checksum: string;
  record_id: string;
  version: number;
};

type GenerationRunRow = QueryResultRow & {
  id: string;
  status: 'failed' | 'queued' | 'running' | 'succeeded';
};

export type PublishResult = {
  checksum: string;
  date: string;
  puzzleId: string;
  status: 'already-published' | 'published';
  version: number;
};

type PublishInput = {
  catalog: CatalogSnapshot;
  publication: DailyPublication;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function requestHash(input: Record<string, string>): string {
  const stableEntries = Object.entries(input).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return createHash('sha256')
    .update(JSON.stringify(Object.fromEntries(stableEntries)))
    .digest('hex');
}

function puzzleChecksum(publication: DailyPublication): string {
  return createHash('sha256')
    .update(JSON.stringify(publication.puzzle))
    .digest('hex');
}

function validatePublication(publication: DailyPublication): void {
  if (
    publication.quality.passed !== true ||
    publication.quality.issues.length > 0
  ) {
    throw new Error(
      `Daily puzzle "${publication.puzzle.id}" did not pass its quality gate.`,
    );
  }

  if (publication.puzzle.id !== `gunun-${publication.date}`) {
    throw new Error(
      `Daily puzzle ID "${publication.puzzle.id}" does not match ${publication.date}.`,
    );
  }
}

async function findPublishedPuzzle(
  client: PoolClient,
  date: string,
): Promise<PublishedPuzzleRow | null> {
  const result = await client.query<PublishedPuzzleRow>(
    `
      SELECT
        p.record_id,
        p.id AS puzzle_id,
        p.version,
        p.checksum
      FROM puzzle_publications publication
      INNER JOIN puzzles p ON p.record_id = publication.puzzle_record_id
      WHERE
        publication.publication_date = $1
        AND publication.publication_key = 'daily'
        AND publication.status = 'published'
      LIMIT 1
    `,
    [date],
  );

  return result.rows[0] ?? null;
}

function comparePublishedPuzzle(
  existing: PublishedPuzzleRow,
  publication: DailyPublication,
  checksum: string,
): PublishResult {
  if (
    existing.puzzle_id !== publication.puzzle.id ||
    existing.checksum !== checksum
  ) {
    throw new Error(
      `Published daily puzzle for ${publication.date} is immutable and differs from generation output.`,
    );
  }

  return {
    checksum,
    date: publication.date,
    puzzleId: existing.puzzle_id,
    status: 'already-published',
    version: existing.version,
  };
}

async function beginGenerationRun(
  client: PoolClient,
  input: PublishInput,
): Promise<string> {
  const { catalog, publication } = input;
  const hash = requestHash({
    catalogChecksum: catalog.checksum,
    date: publication.date,
    revision: publication.revision,
    seed: publication.recipe.seed,
  });
  const result = await client.query<GenerationRunRow>(
    `
      INSERT INTO generation_runs (
        catalog_version_id,
        profile_id,
        publication_date,
        request_hash,
        revision,
        seed,
        started_at,
        status
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'running')
      ON CONFLICT (request_hash) DO UPDATE SET
        completed_at = NULL,
        error = NULL,
        profile_id = EXCLUDED.profile_id,
        revision = EXCLUDED.revision,
        seed = EXCLUDED.seed,
        started_at = NOW(),
        status = 'running'
      WHERE generation_runs.status <> 'succeeded'
      RETURNING id, status
    `,
    [
      catalog.catalogVersionId,
      publication.profileId,
      publication.date,
      hash,
      publication.revision,
      publication.recipe.seed,
    ],
  );
  const run = result.rows[0];

  if (run) {
    return run.id;
  }

  const existingResult = await client.query<GenerationRunRow>(
    'SELECT id, status FROM generation_runs WHERE request_hash = $1',
    [hash],
  );
  const existing = existingResult.rows[0];

  if (existing?.status === 'succeeded') {
    throw new Error(
      `Generation request for ${publication.date} already succeeded without a matching publication.`,
    );
  }

  throw new Error(`Could not start generation run for ${publication.date}.`);
}

async function markGenerationFailed(
  client: PoolClient,
  generationRunId: string,
  error: unknown,
): Promise<void> {
  await client.query(
    `
      UPDATE generation_runs
      SET completed_at = NOW(), error = $2, status = 'failed'
      WHERE id = $1
    `,
    [generationRunId, errorMessage(error)],
  );
}

export async function recordGenerationFailure(
  client: PoolClient,
  catalog: CatalogSnapshot,
  input: { date: string; error: unknown; revision: string },
): Promise<void> {
  const seed = `${input.date}:${input.revision}:unresolved`;
  const hash = requestHash({
    catalogChecksum: catalog.checksum,
    date: input.date,
    revision: input.revision,
    seed,
  });

  await client.query(
    `
      INSERT INTO generation_runs (
        catalog_version_id,
        completed_at,
        error,
        profile_id,
        publication_date,
        request_hash,
        revision,
        seed,
        started_at,
        status
      )
      VALUES ($1, NOW(), $2, 'unresolved', $3, $4, $5, $6, NOW(), 'failed')
      ON CONFLICT (request_hash) DO UPDATE SET
        completed_at = NOW(),
        error = EXCLUDED.error,
        started_at = NOW(),
        status = 'failed'
    `,
    [
      catalog.catalogVersionId,
      errorMessage(input.error),
      input.date,
      hash,
      input.revision,
      seed,
    ],
  );
}

export async function publishDailyPublication(
  client: PoolClient,
  input: PublishInput,
): Promise<PublishResult> {
  const { catalog, publication } = input;
  validatePublication(publication);
  const checksum = puzzleChecksum(publication);
  const existing = await findPublishedPuzzle(client, publication.date);

  if (existing) {
    return comparePublishedPuzzle(existing, publication, checksum);
  }

  const generationRunId = await beginGenerationRun(client, input);

  try {
    await client.query('BEGIN');
    const publishedInsideTransaction = await findPublishedPuzzle(
      client,
      publication.date,
    );

    if (publishedInsideTransaction) {
      const result = comparePublishedPuzzle(
        publishedInsideTransaction,
        publication,
        checksum,
      );
      await client.query(
        `
          UPDATE generation_runs
          SET completed_at = NOW(), quality_report = $2::jsonb, status = 'succeeded'
          WHERE id = $1
        `,
        [generationRunId, JSON.stringify(publication.quality)],
      );
      await client.query('COMMIT');
      return result;
    }

    const versionResult = await client.query<PuzzleVersionRow>(
      `
        SELECT record_id, version, checksum
        FROM puzzles
        WHERE id = $1
        ORDER BY version DESC
        LIMIT 1
      `,
      [publication.puzzle.id],
    );
    const latestVersion = versionResult.rows[0];
    let puzzleRecordId: string;
    let version: number;

    if (latestVersion?.checksum === checksum) {
      puzzleRecordId = latestVersion.record_id;
      version = latestVersion.version;
    } else {
      version = (latestVersion?.version ?? 0) + 1;
      const insertedPuzzle = await client.query<{ record_id: string }>(
        `
          INSERT INTO puzzles (
            catalog_version_id,
            categories,
            checksum,
            column_count,
            definition,
            difficulty,
            id,
            quality_passed,
            row_count,
            title,
            validation_mode,
            version
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, true, $8, $9, 'offline-casual', $10)
          RETURNING record_id
        `,
        [
          catalog.catalogVersionId,
          publication.puzzle.categories,
          checksum,
          publication.puzzle.columnCount,
          JSON.stringify(publication.puzzle),
          publication.puzzle.difficulty,
          publication.puzzle.id,
          publication.puzzle.rowCount,
          publication.puzzle.title,
          version,
        ],
      );
      const insertedRecord = insertedPuzzle.rows[0];

      if (!insertedRecord) {
        throw new Error(`Could not store puzzle "${publication.puzzle.id}".`);
      }

      puzzleRecordId = insertedRecord.record_id;
    }

    await client.query(
      `
        INSERT INTO puzzle_publications (
          publication_date,
          publication_key,
          published_at,
          puzzle_record_id,
          status,
          timezone
        )
        VALUES ($1, 'daily', NOW(), $2, 'published', 'Europe/Istanbul')
      `,
      [publication.date, puzzleRecordId],
    );
    await client.query(
      `
        UPDATE generation_runs
        SET completed_at = NOW(), quality_report = $2::jsonb, status = 'succeeded'
        WHERE id = $1
      `,
      [generationRunId, JSON.stringify(publication.quality)],
    );
    await client.query('COMMIT');

    return {
      checksum,
      date: publication.date,
      puzzleId: publication.puzzle.id,
      status: 'published',
      version,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    await markGenerationFailed(client, generationRunId, error);
    throw error;
  }
}
