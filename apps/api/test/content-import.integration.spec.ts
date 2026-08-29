import { randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  importGeneratedContent,
  type GeneratedContentPaths,
  type ImportTransaction,
  type ImportTransactionRunner,
} from '../src/content/import-content';
import {
  clueCatalogVersions,
  clues,
  generationRuns,
  puzzlePublications,
  puzzles,
} from '../src/database/schema';

const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;
const importSchema = {
  clueCatalogVersions,
  clues,
  generationRuns,
  puzzlePublications,
  puzzles,
};

function puzzle(id: string, title: string) {
  return {
    categories: ['genel_kultur'],
    cells: [{ type: 'letter' }],
    columnCount: 1,
    difficulty: 'easy',
    id,
    initialSelection: { cellIndex: 0, wordId: `${id}-word` },
    rowCount: 1,
    title,
    words: [{ id: `${id}-word` }],
  };
}

describeWithDatabase('generated content PostgreSQL integration', () => {
  let client: PoolClient;
  let pool: Pool;
  let temporaryDirectory: string;
  let paths: GeneratedContentPaths;
  let transactionRunner: ImportTransactionRunner;
  const suffix = randomUUID();
  const dailyPuzzleId = `integration-daily-${suffix}`;
  const conflictingDailyPuzzleId = `integration-daily-conflict-${suffix}`;
  const publicationDate = '2099-12-30';

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    client = await pool.connect();
    await client.query('BEGIN');

    const database = drizzle(client, { schema: importSchema });
    let savepointSequence = 0;
    transactionRunner = async <T>(
      callback: (transaction: ImportTransaction) => Promise<T>,
    ) => {
      savepointSequence += 1;
      const savepoint = `content_import_${savepointSequence}`;
      await client.query(`SAVEPOINT ${savepoint}`);

      try {
        const result = await callback(database);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        return result;
      } catch (error) {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        throw error;
      }
    };

    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), 'cengel-content-import-'),
    );
    const dailyDirectory = path.join(temporaryDirectory, 'daily');
    await mkdir(dailyDirectory);
    paths = {
      catalogPath: path.join(temporaryDirectory, 'clue-catalog.json'),
      dailyDirectory,
      manifestPath: path.join(temporaryDirectory, 'puzzles.json'),
    };

    await Promise.all([
      writeFile(
        paths.catalogPath,
        JSON.stringify({
          entries: [
            {
              answer: 'TEST',
              answerLength: 4,
              category: 'genel_kultur',
              clue: 'Entegrasyon denemesi',
              difficulty: 'easy',
              fallbackOnly: false,
              id: `integration-clue-${suffix}`,
              kind: 'kelime',
              shortClue: 'Deneme',
            },
          ],
          rights: {
            basis: 'project-owned',
            confirmedAt: '2026-08-19',
          },
          sourceFile: `integration-${suffix}.jsonl`,
        }),
      ),
      writeFile(
        paths.manifestPath,
        JSON.stringify({ puzzles: [], schemaVersion: 1 }),
      ),
      writeFile(
        path.join(dailyDirectory, `${publicationDate}.json`),
        JSON.stringify({
          date: publicationDate,
          profileId: `integration-profile-${suffix}`,
          puzzle: puzzle(dailyPuzzleId, 'Entegrasyon günlük bulmacası'),
          quality: { passed: true },
          recipe: { seed: `integration-seed-${suffix}` },
          revision: 'v1',
          schemaVersion: 1,
        }),
      ),
    ]);
  });

  afterAll(async () => {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
    await rm(temporaryDirectory, { force: true, recursive: true });
  });

  it('imports idempotently and rolls back a conflicting publication', async () => {
    const first = await importGeneratedContent({ paths, transactionRunner });
    expect(first).toMatchObject({
      catalogEntries: 1,
      catalogVersionsInserted: 1,
      cluesInserted: 1,
      generationRunsInserted: 1,
      publicationsInserted: 1,
      puzzlesInserted: 1,
    });

    const second = await importGeneratedContent({ paths, transactionRunner });
    expect(second).toMatchObject({
      catalogEntries: 1,
      catalogVersionId: first.catalogVersionId,
      catalogVersionsInserted: 0,
      cluesInserted: 0,
      generationRunsInserted: 0,
      publicationsInserted: 0,
      puzzlesInserted: 0,
    });

    const dailyPath = path.join(paths.dailyDirectory, `${publicationDate}.json`);
    await writeFile(
      dailyPath,
      JSON.stringify({
        date: publicationDate,
        profileId: `integration-profile-${suffix}`,
        puzzle: puzzle(conflictingDailyPuzzleId, 'Çakışan günlük bulmaca'),
        quality: { passed: true },
        recipe: { seed: `integration-conflict-${suffix}` },
        revision: 'v2',
        schemaVersion: 1,
      }),
    );

    await expect(
      importGeneratedContent({ paths, transactionRunner }),
    ).rejects.toThrow(
      `Publication "${publicationDate}/daily" conflicts with the stored published puzzle.`,
    );

    const conflictingPuzzle = await client.query(
      'SELECT id FROM puzzles WHERE id = $1',
      [conflictingDailyPuzzleId],
    );
    expect(conflictingPuzzle.rowCount).toBe(0);

    const persistedClues = await client.query(
      'SELECT count(*)::int AS count FROM clues WHERE catalog_version_id = $1',
      [first.catalogVersionId],
    );
    expect(persistedClues.rows[0]).toEqual({ count: 1 });
  });
});
