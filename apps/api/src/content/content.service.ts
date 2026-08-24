import { createHash } from 'node:crypto';

import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, lt, lte, or, sql } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import {
  clueCatalogVersions,
  puzzlePublications,
  puzzles,
} from '../database/schema';

export type PuzzleSummary = {
  categories: readonly string[];
  columnCount: number;
  difficulty: 'beginner' | 'easy' | 'hard' | 'medium';
  id: string;
  publicationDate: string;
  rowCount: number;
  title: string;
};

export type PuzzleListResult = {
  catalogVersion: string;
  items: readonly PuzzleSummary[];
  nextCursor: string | null;
};

export type PublishedCatalogResult = {
  apiVersion: 1;
  catalogVersion: string;
  manifest: {
    puzzles: readonly Record<string, unknown>[];
    rights: {
      basis: 'project-owned';
      confirmedAt: '2026-08-19';
    };
    schemaVersion: 1;
    sourceCatalog: string;
  };
};

type ListOptions = {
  category?: string;
  cursor?: string;
  difficulty?: PuzzleSummary['difficulty'];
  limit: number;
  visibleOn: string;
};

type CursorValue = { id: string; publicationDate: string };

function encodeCursor(value: CursorValue): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

export function decodeCursor(cursor: string): CursorValue {
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;

    if (
      typeof value === 'object' &&
      value !== null &&
      'id' in value &&
      typeof value.id === 'string' &&
      'publicationDate' in value &&
      typeof value.publicationDate === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(value.publicationDate)
    ) {
      return { id: value.id, publicationDate: value.publicationDate };
    }
  } catch {
    // Normalized below.
  }

  throw new Error('Invalid puzzle cursor.');
}

@Injectable()
export class ContentService {
  constructor(private readonly database: DatabaseService) {}

  private async getCatalogVersion(): Promise<string> {
    const [catalog] = await this.database.db
      .select({ id: clueCatalogVersions.id })
      .from(clueCatalogVersions)
      .orderBy(desc(clueCatalogVersions.importedAt))
      .limit(1);

    if (!catalog) {
      throw new NotFoundException('No published puzzle catalog is available.');
    }

    return catalog.id;
  }

  async list(options: ListOptions): Promise<PuzzleListResult> {
    const cursor = options.cursor ? decodeCursor(options.cursor) : undefined;
    const conditions = [
      eq(puzzlePublications.status, 'published'),
      lte(puzzlePublications.publicationDate, options.visibleOn),
      eq(puzzles.qualityPassed, true),
    ];

    if (options.category) {
      conditions.push(sql`${options.category} = ANY(${puzzles.categories})`);
    }

    if (options.difficulty) {
      conditions.push(eq(puzzles.difficulty, options.difficulty));
    }

    if (cursor) {
      conditions.push(
        or(
          lt(puzzlePublications.publicationDate, cursor.publicationDate),
          and(
            eq(puzzlePublications.publicationDate, cursor.publicationDate),
            lt(puzzles.id, cursor.id),
          ),
        )!,
      );
    }

    const rows = await this.database.db
      .select({
        categories: puzzles.categories,
        columnCount: puzzles.columnCount,
        difficulty: puzzles.difficulty,
        id: puzzles.id,
        publicationDate: puzzlePublications.publicationDate,
        rowCount: puzzles.rowCount,
        title: puzzles.title,
      })
      .from(puzzlePublications)
      .innerJoin(puzzles, eq(puzzlePublications.puzzleRecordId, puzzles.recordId))
      .where(and(...conditions))
      .orderBy(desc(puzzlePublications.publicationDate), desc(puzzles.id))
      .limit(options.limit + 1);
    const hasNextPage = rows.length > options.limit;
    const items = hasNextPage ? rows.slice(0, options.limit) : rows;
    const lastItem = items.at(-1);

    return {
      catalogVersion: await this.getCatalogVersion(),
      items,
      nextCursor:
        hasNextPage && lastItem
          ? encodeCursor({ id: lastItem.id, publicationDate: lastItem.publicationDate })
          : null,
    };
  }

  async catalog(visibleOn: string): Promise<PublishedCatalogResult> {
    const rows = await this.database.db
      .select({
        checksum: puzzles.checksum,
        definition: puzzles.definition,
        id: puzzles.id,
        version: puzzles.version,
      })
      .from(puzzlePublications)
      .innerJoin(puzzles, eq(puzzlePublications.puzzleRecordId, puzzles.recordId))
      .where(
        and(
          eq(puzzlePublications.status, 'published'),
          lte(puzzlePublications.publicationDate, visibleOn),
          eq(puzzles.qualityPassed, true),
        ),
      )
      .orderBy(desc(puzzlePublications.publicationDate), desc(puzzles.version));
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const publishedRows = [...rowsById.values()];
    const signature = publishedRows
      .map(({ checksum, id, version }) => `${id}:${version}:${checksum}`)
      .sort()
      .join('|');
    const catalogVersion = `catalog-${createHash('sha256')
      .update(signature)
      .digest('hex')
      .slice(0, 16)}`;

    return {
      apiVersion: 1,
      catalogVersion,
      manifest: {
        puzzles: publishedRows.map(({ definition }) => definition),
        rights: {
          basis: 'project-owned',
          confirmedAt: '2026-08-19',
        },
        schemaVersion: 1,
        sourceCatalog: await this.getCatalogVersion(),
      },
    };
  }

  async findById(id: string, visibleOn: string) {
    const [row] = await this.database.db
      .select({ definition: puzzles.definition })
      .from(puzzlePublications)
      .innerJoin(puzzles, eq(puzzlePublications.puzzleRecordId, puzzles.recordId))
      .where(
        and(
          eq(puzzles.id, id),
          eq(puzzles.qualityPassed, true),
          eq(puzzlePublications.status, 'published'),
          lte(puzzlePublications.publicationDate, visibleOn),
        ),
      )
      .orderBy(desc(puzzles.version))
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Puzzle "${id}" was not found.`);
    }

    return {
      catalogVersion: await this.getCatalogVersion(),
      puzzle: row.definition,
    };
  }

  async findDaily(date: string) {
    const [row] = await this.database.db
      .select({ definition: puzzles.definition })
      .from(puzzlePublications)
      .innerJoin(puzzles, eq(puzzlePublications.puzzleRecordId, puzzles.recordId))
      .where(
        and(
          eq(puzzlePublications.publicationKey, 'daily'),
          eq(puzzlePublications.publicationDate, date),
          eq(puzzlePublications.status, 'published'),
          eq(puzzles.qualityPassed, true),
        ),
      )
      .limit(1);

    if (!row) {
      throw new NotFoundException(`Daily puzzle for "${date}" was not found.`);
    }

    return {
      catalogVersion: await this.getCatalogVersion(),
      puzzle: row.definition,
    };
  }
}
