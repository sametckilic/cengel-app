import type { PoolClient, QueryResultRow } from 'pg';

import type {
  CatalogSnapshot,
  ClueEntry,
  GameplayDifficulty,
} from './types';

type CatalogVersionRow = QueryResultRow & {
  checksum: string;
  confirmed_at: string;
  id: string;
  rights_basis: string;
  source_file: string;
};

type ClueRow = QueryResultRow & {
  answer: string;
  answer_length: number;
  category: string;
  clue: string;
  difficulty: GameplayDifficulty;
  fallback_only: boolean;
  id: string;
  kind: string;
  short_clue: string;
};

export async function loadCurrentCatalog(
  client: PoolClient,
): Promise<CatalogSnapshot> {
  const versionResult = await client.query<CatalogVersionRow>(`
    SELECT id, checksum, confirmed_at, rights_basis, source_file
    FROM clue_catalog_versions
    ORDER BY imported_at DESC, id DESC
    LIMIT 1
  `);
  const version = versionResult.rows[0];

  if (!version) {
    throw new Error('No clue catalog version is available for generation.');
  }

  if (version.rights_basis !== 'project-owned') {
    throw new Error(
      `Unsupported clue catalog rights basis: ${version.rights_basis}`,
    );
  }

  const clueResult = await client.query<ClueRow>(
    `
      SELECT
        id,
        answer,
        answer_length,
        clue,
        short_clue,
        difficulty,
        fallback_only,
        category,
        kind
      FROM clues
      WHERE catalog_version_id = $1
      ORDER BY id
    `,
    [version.id],
  );

  if (clueResult.rows.length === 0) {
    throw new Error(`Clue catalog version "${version.id}" contains no clues.`);
  }

  const entries: ClueEntry[] = clueResult.rows.map((row) => ({
    answer: row.answer,
    answerLength: row.answer_length,
    category: row.category,
    clue: row.clue,
    difficulty: row.difficulty,
    fallbackOnly: row.fallback_only,
    id: row.id,
    kind: row.kind,
    shortClue: row.short_clue,
  }));

  return {
    catalog: {
      entries,
      rights: {
        basis: 'project-owned',
        confirmedAt: version.confirmed_at,
      },
      schemaVersion: 1,
      sourceFile: version.source_file,
      usage: 'project-owned',
    },
    catalogVersionId: version.id,
    checksum: version.checksum,
  };
}
