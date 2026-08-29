import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

import type {
  PublicationAccessRequest,
  RequiredContentEntitlement,
} from '@cengel/contracts/content-publication-policy' with { 'resolution-mode': 'import' };
import type { PoolClient, QueryResultRow } from 'pg';

import type { CatalogSnapshot, DailyPublication } from './types';
import { checksumJson } from './canonical-json';

const loadModule = createRequire(__filename);
const { resolveRequiredEntitlement } = loadModule(
  '@cengel/contracts/content-publication-policy',
) as {
  resolveRequiredEntitlement: (
    publication: PublicationAccessRequest,
  ) => RequiredContentEntitlement;
};

type PublishedPuzzleRow = QueryResultRow & {
  checksum: string;
  puzzle_id: string;
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
  publicationKey: string;
  puzzleId: string;
  status: 'already-published' | 'published';
  version: number;
};

export type PublicationTarget = {
  channel: PublicationAccessRequest['channel'];
  publicationDate: string;
  publicationKey: string;
  requiredEntitlement: RequiredContentEntitlement;
};

type BasePublishInput = {
  catalog: CatalogSnapshot;
  publication: DailyPublication;
};

type PublishInput = BasePublishInput & {
  target: PublicationTarget;
};

type PackPublishInput = BasePublishInput & {
  packId: string;
  puzzleNumber: number;
};

function validateDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Publication date must use YYYY-MM-DD format.');
  }
}

function validateKeySegment(value: string, label: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    throw new Error(`${label} must use lowercase letters, numbers, and hyphens.`);
  }
}

export function createDailyPublicationTarget(date: string): PublicationTarget {
  validateDate(date);

  return {
    channel: 'daily',
    publicationDate: date,
    publicationKey: 'daily',
    requiredEntitlement: resolveRequiredEntitlement({ channel: 'daily' }),
  };
}

export function createArchivePublicationTarget(
  date: string,
  puzzleId: string,
): PublicationTarget {
  validateDate(date);
  validateKeySegment(puzzleId, 'Archive puzzle ID');

  return {
    channel: 'archive',
    publicationDate: date,
    publicationKey: `archive:${puzzleId}`,
    requiredEntitlement: resolveRequiredEntitlement({ channel: 'archive' }),
  };
}

export function createPackPublicationTarget(
  date: string,
  packId: string,
  puzzleNumber: number,
): PublicationTarget {
  validateDate(date);
  validateKeySegment(packId, 'Pack ID');
  const requiredEntitlement = resolveRequiredEntitlement({
    channel: 'pack',
    puzzleNumber,
  });

  return {
    channel: 'pack',
    publicationDate: date,
    publicationKey: `pack:${packId}:${puzzleNumber}`,
    requiredEntitlement,
  };
}

export function createPublicationInsertParameters(
  target: PublicationTarget,
  puzzleRecordId: string,
): [string, string, string, RequiredContentEntitlement] {
  return [
    target.publicationDate,
    target.publicationKey,
    puzzleRecordId,
    target.requiredEntitlement,
  ];
}

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
  return checksumJson(publication.puzzle);
}

function validatePublication(
  publication: DailyPublication,
  target: PublicationTarget,
): void {
  if (
    publication.quality.passed !== true ||
    publication.quality.issues.length > 0
  ) {
    throw new Error(
      `Puzzle "${publication.puzzle.id}" did not pass its quality gate.`,
    );
  }

  if (publication.date !== target.publicationDate) {
    throw new Error(
      `Puzzle publication date "${publication.date}" does not match ${target.publicationDate}.`,
    );
  }

  if (
    target.channel === 'daily' &&
    publication.puzzle.id !== `gunun-${publication.date}`
  ) {
    throw new Error(
      `Daily puzzle ID "${publication.puzzle.id}" does not match ${publication.date}.`,
    );
  }
}

export function toAlreadyPublishedResult(
  existing: PublishedPuzzleRow,
  target: PublicationTarget,
): PublishResult {
  return {
    checksum: existing.checksum,
    date: target.publicationDate,
    publicationKey: target.publicationKey,
    puzzleId: existing.puzzle_id,
    status: 'already-published',
    version: existing.version,
  };
}

async function findPublishedPuzzle(
  client: PoolClient,
  target: PublicationTarget,
): Promise<PublishResult | null> {
  const result = await client.query<PublishedPuzzleRow>(
    `
      SELECT
        p.id AS puzzle_id,
        p.version,
        p.checksum
      FROM puzzle_publications publication
      INNER JOIN puzzles p ON p.record_id = publication.puzzle_record_id
      WHERE
        publication.publication_date = $1
        AND publication.publication_key = $2
        AND publication.status = 'published'
      LIMIT 1
    `,
    [target.publicationDate, target.publicationKey],
  );

  const existing = result.rows[0];
  return existing ? toAlreadyPublishedResult(existing, target) : null;
}

export async function findPublishedDailyPuzzle(
  client: PoolClient,
  date: string,
): Promise<PublishResult | null> {
  return findPublishedPuzzle(client, createDailyPublicationTarget(date));
}

async function beginGenerationRun(
  client: PoolClient,
  input: PublishInput,
): Promise<string> {
  const { catalog, publication, target } = input;
  const hash = requestHash({
    catalogChecksum: catalog.checksum,
    date: publication.date,
    publicationKey: target.publicationKey,
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
      `Generation request for ${target.publicationKey} on ${publication.date} ` +
        'already succeeded without a matching publication.',
    );
  }

  throw new Error(
    `Could not start generation run for ${target.publicationKey} on ${publication.date}.`,
  );
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

async function publishPublication(
  client: PoolClient,
  input: PublishInput,
): Promise<PublishResult> {
  const { catalog, publication, target } = input;
  validatePublication(publication, target);
  const checksum = puzzleChecksum(publication);
  const existing = await findPublishedPuzzle(client, target);

  if (existing) {
    return existing;
  }

  const generationRunId = await beginGenerationRun(client, input);

  try {
    await client.query('BEGIN');
    const publishedInsideTransaction = await findPublishedPuzzle(client, target);

    if (publishedInsideTransaction) {
      await client.query(
        `
          UPDATE generation_runs
          SET completed_at = NOW(), quality_report = $2::jsonb, status = 'succeeded'
          WHERE id = $1
        `,
        [generationRunId, JSON.stringify(publication.quality)],
      );
      await client.query('COMMIT');
      return publishedInsideTransaction;
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
          required_entitlement,
          status,
          timezone
        )
        VALUES ($1, $2, NOW(), $3, $4, 'published', 'Europe/Istanbul')
      `,
      createPublicationInsertParameters(target, puzzleRecordId),
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
      publicationKey: target.publicationKey,
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

export async function publishDailyPublication(
  client: PoolClient,
  input: BasePublishInput,
): Promise<PublishResult> {
  return publishPublication(client, {
    ...input,
    target: createDailyPublicationTarget(input.publication.date),
  });
}

export async function publishArchivePublication(
  client: PoolClient,
  input: BasePublishInput,
): Promise<PublishResult> {
  return publishPublication(client, {
    ...input,
    target: createArchivePublicationTarget(
      input.publication.date,
      input.publication.puzzle.id,
    ),
  });
}

export async function publishPackPublication(
  client: PoolClient,
  input: PackPublishInput,
): Promise<PublishResult> {
  return publishPublication(client, {
    catalog: input.catalog,
    publication: input.publication,
    target: createPackPublicationTarget(
      input.publication.date,
      input.packId,
      input.puzzleNumber,
    ),
  });
}
