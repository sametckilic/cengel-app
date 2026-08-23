import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  parsePuzzleCatalogCache,
  type PuzzleCatalogCacheSnapshot,
  type PuzzleCatalogCacheStore,
  serializePuzzleCatalogCache,
} from '@/services/puzzle-catalog-cache';

const DATABASE_NAME = 'cengel-catalog.db';
const CACHE_KEY = 'published-catalog';
let databasePromise: Promise<SQLiteDatabase> | undefined;

type CatalogRow = {
  payload: string;
};

async function openCatalogDatabase(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync(DATABASE_NAME);

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS puzzle_catalog_cache (
      cache_key TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return database;
}

function getDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= openCatalogDatabase();
  return databasePromise;
}

export const puzzleCatalogStore: PuzzleCatalogCacheStore = {
  async load() {
    const database = await getDatabase();
    const row = await database.getFirstAsync<CatalogRow>(
      'SELECT payload FROM puzzle_catalog_cache WHERE cache_key = ?',
      CACHE_KEY,
    );

    return row ? parsePuzzleCatalogCache(row.payload) : null;
  },
  async save(snapshot: PuzzleCatalogCacheSnapshot) {
    const database = await getDatabase();
    const payload = serializePuzzleCatalogCache(snapshot);

    await database.runAsync(
      `INSERT INTO puzzle_catalog_cache (cache_key, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(cache_key) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      CACHE_KEY,
      payload,
      snapshot.cachedAt,
    );
  },
};
