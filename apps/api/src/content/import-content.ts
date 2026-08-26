import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

import { count, eq, sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { z } from 'zod';

import { validateEnvironment } from '../config/environment';
import {
  clueCatalogVersions,
  clues,
  generationRuns,
  puzzlePublications,
  puzzles,
} from '../database/schema';

const IMPORT_SCHEMA = {
  clueCatalogVersions,
  clues,
  generationRuns,
  puzzlePublications,
  puzzles,
};
export type ImportTransaction = NodePgDatabase<typeof IMPORT_SCHEMA>;
export type ImportTransactionRunner = <T>(
  callback: (transaction: ImportTransaction) => Promise<T>,
) => Promise<T>;

const difficultySchema = z.enum(['beginner', 'easy', 'medium', 'hard']);
const puzzleSchema = z
  .object({
    categories: z.array(z.string()).min(1),
    cells: z.array(z.unknown()).min(1),
    columnCount: z.number().int().positive(),
    difficulty: difficultySchema,
    id: z.string().min(1),
    initialSelection: z.object({
      cellIndex: z.number().int().nonnegative(),
      wordId: z.string().min(1),
    }),
    rowCount: z.number().int().positive(),
    title: z.string().min(1),
    words: z.array(z.unknown()).min(1),
  })
  .passthrough();
const catalogSchema = z.object({
  entries: z.array(
    z.object({
      answer: z.string().min(1),
      answerLength: z.number().int().positive(),
      category: z.string().min(1),
      clue: z.string().min(1),
      difficulty: difficultySchema,
      fallbackOnly: z.boolean(),
      id: z.string().min(1),
      kind: z.string().min(1),
      shortClue: z.string().min(1),
    }),
  ),
  rights: z.object({
    basis: z.literal('project-owned'),
    confirmedAt: z.literal('2026-08-19'),
  }),
  sourceFile: z.string().min(1),
});
const manifestSchema = z.object({
  puzzles: z.array(puzzleSchema),
  schemaVersion: z.literal(1),
});
const dailyPublicationSchema = z.object({
  date: z.iso.date(),
  profileId: z.string().min(1),
  puzzle: puzzleSchema,
  quality: z.object({ passed: z.literal(true) }).passthrough(),
  recipe: z.object({ seed: z.string().min(1) }).passthrough(),
  revision: z.string().min(1),
  schemaVersion: z.literal(1),
});

type PuzzleDocument = z.infer<typeof puzzleSchema>;
type PuzzleImport = {
  definition: PuzzleDocument;
  publicationDate: string;
  publicationKey: string;
};
type ImportSummary = {
  catalogEntries: number;
  catalogVersionId: string;
  catalogVersionsInserted: number;
  cluesInserted: number;
  generationRunsInserted: number;
  publicationsInserted: number;
  puzzlesInserted: number;
};

export type GeneratedContentPaths = {
  catalogPath: string;
  dailyDirectory: string;
  manifestPath: string;
  prototypePath: string;
};

export type ImportGeneratedContentOptions = {
  connection?: {
    connectionTimeoutMillis?: number;
    databaseUrl: string;
    maxConnections?: number;
    ssl?: boolean;
  };
  paths?: GeneratedContentPaths;
  transactionRunner?: ImportTransactionRunner;
};

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../..');
const CATALOG_PATH = path.join(
  REPOSITORY_ROOT,
  'apps/mobile/data/generated/clue-catalog.json',
);
const MANIFEST_PATH = path.join(
  REPOSITORY_ROOT,
  'apps/mobile/data/generated/puzzles.json',
);
const PROTOTYPE_PATH = path.join(
  REPOSITORY_ROOT,
  'apps/mobile/data/generated/newspaper-prototype-8x8.json',
);
const DAILY_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  'apps/mobile/data/generated/daily',
);
const DEFAULT_CONTENT_PATHS: GeneratedContentPaths = {
  catalogPath: CATALOG_PATH,
  dailyDirectory: DAILY_DIRECTORY,
  manifestPath: MANIFEST_PATH,
  prototypePath: PROTOTYPE_PATH,
};

function checksum(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function parseJson<T>(contents: string, schema: z.ZodType<T>, source: string): T {
  const result = schema.safeParse(JSON.parse(contents) as unknown);

  if (!result.success) {
    throw new Error(
      `Invalid generated content in ${source}: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}

async function readDailyPublications(dailyDirectory: string): Promise<
  readonly {
    contents: string;
    publication: z.infer<typeof dailyPublicationSchema>;
  }[]
> {
  const fileNames = (await readdir(dailyDirectory))
    .filter((fileName) => fileName.endsWith('.json'))
    .sort();

  return Promise.all(
    fileNames.map(async (fileName) => {
      const filePath = path.join(dailyDirectory, fileName);
      const contents = await readFile(filePath, 'utf8');

      return {
        contents,
        publication: parseJson(contents, dailyPublicationSchema, filePath),
      };
    }),
  );
}

function collectPuzzleImports(
  manifestPuzzles: readonly PuzzleDocument[],
  prototype: PuzzleDocument,
  dailyDocuments: Awaited<ReturnType<typeof readDailyPublications>>,
  catalogReleaseDate: string,
): readonly PuzzleImport[] {
  const importsById = new Map<string, PuzzleImport>();
  const addPuzzle = (entry: PuzzleImport): void => {
    const existing = importsById.get(entry.definition.id);

    if (
      existing &&
      checksum(JSON.stringify(existing.definition)) !==
        checksum(JSON.stringify(entry.definition))
    ) {
      throw new Error(`Puzzle "${entry.definition.id}" has conflicting definitions.`);
    }

    importsById.set(entry.definition.id, entry);
  };

  addPuzzle({
    definition: prototype,
    publicationDate: catalogReleaseDate,
    publicationKey: `catalog:${prototype.id}`,
  });

  for (const puzzle of manifestPuzzles) {
    const dailyDate = /^gunun-(\d{4}-\d{2}-\d{2})$/.exec(puzzle.id)?.[1];
    addPuzzle({
      definition: puzzle,
      publicationDate: dailyDate ?? catalogReleaseDate,
      publicationKey: dailyDate ? 'daily' : `catalog:${puzzle.id}`,
    });
  }

  for (const { publication } of dailyDocuments) {
    addPuzzle({
      definition: publication.puzzle,
      publicationDate: publication.date,
      publicationKey: 'daily',
    });
  }

  return [...importsById.values()].sort((left, right) =>
    left.definition.id.localeCompare(right.definition.id),
  );
}

export async function importGeneratedContent(
  options: ImportGeneratedContentOptions = {},
): Promise<ImportSummary> {
  const environment = options.connection || options.transactionRunner
    ? undefined
    : validateEnvironment(process.env);
  const connection =
    options.connection ??
    (environment
      ? {
          connectionTimeoutMillis: environment.DB_CONNECTION_TIMEOUT_MS,
          databaseUrl: environment.DATABASE_URL,
          maxConnections: environment.DB_POOL_MAX,
          ssl: environment.DATABASE_SSL,
        }
      : undefined);
  const paths = options.paths ?? DEFAULT_CONTENT_PATHS;
  const [catalogContents, manifestContents, prototypeContents, dailyDocuments] =
    await Promise.all([
      readFile(paths.catalogPath, 'utf8'),
      readFile(paths.manifestPath, 'utf8'),
      readFile(paths.prototypePath, 'utf8'),
      readDailyPublications(paths.dailyDirectory),
    ]);
  const catalog = parseJson(catalogContents, catalogSchema, paths.catalogPath);
  const manifest = parseJson(
    manifestContents,
    manifestSchema,
    paths.manifestPath,
  );
  const prototype = parseJson(
    prototypeContents,
    puzzleSchema,
    paths.prototypePath,
  );
  const catalogChecksum = checksum(catalogContents);
  const catalogVersionId = `catalog-${catalogChecksum.slice(0, 16)}`;
  const puzzleImports = collectPuzzleImports(
    manifest.puzzles,
    prototype,
    dailyDocuments,
    catalog.rights.confirmedAt,
  );
  let pool: Pool | undefined;
  let transactionRunner = options.transactionRunner;

  if (!transactionRunner) {
    if (!connection) {
      throw new Error('Content import database connection is not configured.');
    }

    pool = new Pool({
      connectionString: connection.databaseUrl,
      connectionTimeoutMillis: connection.connectionTimeoutMillis ?? 5_000,
      max: connection.maxConnections ?? 5,
      ssl: connection.ssl ? { rejectUnauthorized: false } : undefined,
    });
    const database = drizzle(pool, { schema: IMPORT_SCHEMA });
    transactionRunner = (callback) =>
      database.transaction((transaction) =>
        callback(transaction as unknown as ImportTransaction),
      );
  }

  try {
    return await transactionRunner(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext('cengel:content-import'))`,
      );
      const insertedCatalogVersions = await transaction
        .insert(clueCatalogVersions)
        .values({
          checksum: catalogChecksum,
          confirmedAt: catalog.rights.confirmedAt,
          id: catalogVersionId,
          rightsBasis: catalog.rights.basis,
          sourceFile: catalog.sourceFile,
        })
        .onConflictDoNothing()
        .returning({ id: clueCatalogVersions.id });
      let cluesInserted = 0;

      if (insertedCatalogVersions.length > 0) {
        for (let offset = 0; offset < catalog.entries.length; offset += 500) {
          const insertedClues = await transaction
            .insert(clues)
            .values(
              catalog.entries.slice(offset, offset + 500).map((entry) => ({
                ...entry,
                catalogVersionId,
              })),
            )
            .onConflictDoNothing()
            .returning({ id: clues.id });
          cluesInserted += insertedClues.length;
        }
      }

      const [persistedCatalog] = await transaction
        .select({ entryCount: count() })
        .from(clues)
        .where(eq(clues.catalogVersionId, catalogVersionId));

      if (persistedCatalog?.entryCount !== catalog.entries.length) {
        throw new Error(
          `Catalog "${catalogVersionId}" contains ${persistedCatalog?.entryCount ?? 0} ` +
            `persisted clues; ${catalog.entries.length} expected.`,
        );
      }

      const puzzleRecordIds = new Map<string, string>();
      let puzzlesInserted = 0;

      for (const { definition } of puzzleImports) {
        const puzzleChecksum = checksum(JSON.stringify(definition));
        const inserted = await transaction
          .insert(puzzles)
          .values({
            catalogVersionId,
            categories: definition.categories,
            checksum: puzzleChecksum,
            columnCount: definition.columnCount,
            definition,
            difficulty: definition.difficulty,
            id: definition.id,
            qualityPassed: true,
            rowCount: definition.rowCount,
            title: definition.title,
            validationMode: 'offline-casual',
            version: 1,
          })
          .onConflictDoNothing()
          .returning({ recordId: puzzles.recordId });

        if (inserted.length > 0) {
          puzzlesInserted += 1;
          puzzleRecordIds.set(definition.id, inserted[0].recordId);
          continue;
        }

        const existing = await transaction.query.puzzles.findFirst({
          columns: { checksum: true, recordId: true },
          where: (table, operators) =>
            operators.and(
              operators.eq(table.id, definition.id),
              operators.eq(table.version, 1),
            ),
        });

        if (!existing || existing.checksum !== puzzleChecksum) {
          throw new Error(
            `Puzzle "${definition.id}" conflicts with the stored immutable version.`,
          );
        }

        puzzleRecordIds.set(definition.id, existing.recordId);
      }

      let publicationsInserted = 0;

      for (const entry of puzzleImports) {
        const puzzleRecordId = puzzleRecordIds.get(entry.definition.id);

        if (!puzzleRecordId) {
          throw new Error(`Puzzle "${entry.definition.id}" was not imported.`);
        }

        const inserted = await transaction
          .insert(puzzlePublications)
          .values({
            publicationDate: entry.publicationDate,
            publicationKey: entry.publicationKey,
            publishedAt: new Date(`${entry.publicationDate}T00:00:00+03:00`),
            puzzleRecordId,
            status: 'published',
          })
          .onConflictDoNothing()
          .returning({ id: puzzlePublications.id });

        if (inserted.length > 0) {
          publicationsInserted += inserted.length;
          continue;
        }

        const existing = await transaction.query.puzzlePublications.findFirst({
          columns: { puzzleRecordId: true },
          where: (table, operators) =>
            operators.and(
              operators.eq(table.publicationDate, entry.publicationDate),
              operators.eq(table.publicationKey, entry.publicationKey),
              operators.eq(table.status, 'published'),
            ),
        });

        if (!existing || existing.puzzleRecordId !== puzzleRecordId) {
          throw new Error(
            `Publication "${entry.publicationDate}/${entry.publicationKey}" ` +
              'conflicts with the stored published puzzle.',
          );
        }
      }

      let generationRunsInserted = 0;

      for (const { contents, publication } of dailyDocuments) {
        const inserted = await transaction
          .insert(generationRuns)
          .values({
            catalogVersionId,
            completedAt: new Date(`${publication.date}T00:00:00+03:00`),
            profileId: publication.profileId,
            publicationDate: publication.date,
            qualityReport: publication.quality,
            requestHash: checksum(contents),
            revision: publication.revision,
            seed: publication.recipe.seed,
            startedAt: new Date(`${publication.date}T00:00:00+03:00`),
            status: 'succeeded',
          })
          .onConflictDoNothing()
          .returning({ id: generationRuns.id });
        generationRunsInserted += inserted.length;
      }

      return {
        catalogEntries: catalog.entries.length,
        catalogVersionId,
        catalogVersionsInserted: insertedCatalogVersions.length,
        cluesInserted,
        generationRunsInserted,
        publicationsInserted,
        puzzlesInserted,
      };
    });
  } finally {
    await pool?.end();
  }
}

if (require.main === module) {
  void importGeneratedContent()
    .then((summary) => {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`${message}\n`);
      process.exitCode = 1;
    });
}
