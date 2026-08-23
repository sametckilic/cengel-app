import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  parsePuzzleProgress,
  type PuzzleProgressSnapshot,
  type PuzzleProgressStore,
  serializePuzzleProgress,
} from '@/services/puzzle-progress';

const DATABASE_NAME = 'cengel-progress.db';
let databasePromise: Promise<SQLiteDatabase> | undefined;

type ProgressRow = {
  payload: string;
};

async function openProgressDatabase(): Promise<SQLiteDatabase> {
  const database = await openDatabaseAsync(DATABASE_NAME);

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS puzzle_progress (
      puzzle_id TEXT PRIMARY KEY NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS puzzle_progress_updated_at
      ON puzzle_progress(updated_at DESC);
  `);

  return database;
}

function getDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= openProgressDatabase();
  return databasePromise;
}

export const puzzleProgressStore: PuzzleProgressStore = {
  async list() {
    const database = await getDatabase();
    const rows = await database.getAllAsync<ProgressRow>(
      'SELECT payload FROM puzzle_progress ORDER BY updated_at DESC',
    );

    return rows
      .map(({ payload }) => parsePuzzleProgress(payload))
      .filter((progress): progress is PuzzleProgressSnapshot => progress !== null);
  },
  async load(puzzleId) {
    const database = await getDatabase();
    const row = await database.getFirstAsync<ProgressRow>(
      'SELECT payload FROM puzzle_progress WHERE puzzle_id = ?',
      puzzleId,
    );

    return row ? parsePuzzleProgress(row.payload) : null;
  },
  async remove(puzzleId) {
    const database = await getDatabase();
    await database.runAsync('DELETE FROM puzzle_progress WHERE puzzle_id = ?', puzzleId);
  },
  async save(progress) {
    const database = await getDatabase();
    const payload = serializePuzzleProgress(progress);

    await database.runAsync(
      `INSERT INTO puzzle_progress (puzzle_id, payload, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(puzzle_id) DO UPDATE SET
         payload = excluded.payload,
         updated_at = excluded.updated_at`,
      progress.puzzleId,
      payload,
      progress.updatedAt,
    );
  },
};
