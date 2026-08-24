import { randomUUID } from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import {
  parsePuzzleProgress,
  type PuzzleProgressSnapshot,
  type PuzzleProgressStore,
  serializePuzzleProgress,
} from '@cengel/puzzle-core/puzzle-progress';
import type { ProgressSyncEvent } from '@/services/progress-sync';

const DATABASE_NAME = 'cengel-progress.db';
let databasePromise: Promise<SQLiteDatabase> | undefined;

type ProgressRow = {
  payload: string;
};

type MetadataRow = {
  value: string;
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
    CREATE TABLE IF NOT EXISTS progress_metadata (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS progress_sync_outbox (
      puzzle_id TEXT PRIMARY KEY NOT NULL,
      event_id TEXT UNIQUE NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS progress_sync_outbox_created_at
      ON progress_sync_outbox(created_at ASC);
  `);

  return database;
}

export function getProgressDatabase(): Promise<SQLiteDatabase> {
  databasePromise ??= openProgressDatabase();
  return databasePromise;
}

export async function getOrCreateProgressDeviceId(
  database: SQLiteDatabase,
): Promise<string> {
  const existing = await database.getFirstAsync<MetadataRow>(
    "SELECT value FROM progress_metadata WHERE key = 'device-id'",
  );

  if (existing) {
    return existing.value;
  }

  const deviceId = randomUUID();
  await database.runAsync(
    "INSERT OR IGNORE INTO progress_metadata (key, value) VALUES ('device-id', ?)",
    deviceId,
  );
  const stored = await database.getFirstAsync<MetadataRow>(
    "SELECT value FROM progress_metadata WHERE key = 'device-id'",
  );

  return stored?.value ?? deviceId;
}

async function enqueueProgressEvent(
  database: SQLiteDatabase,
  event: ProgressSyncEvent,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO progress_sync_outbox (puzzle_id, event_id, payload, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(puzzle_id) DO UPDATE SET
       event_id = excluded.event_id,
       payload = excluded.payload,
       created_at = excluded.created_at`,
    event.puzzleId,
    event.eventId,
    JSON.stringify(event),
    event.clientUpdatedAt,
  );
}

export const puzzleProgressStore: PuzzleProgressStore = {
  async list() {
    const database = await getProgressDatabase();
    const rows = await database.getAllAsync<ProgressRow>(
      'SELECT payload FROM puzzle_progress ORDER BY updated_at DESC',
    );

    return rows
      .map(({ payload }) => parsePuzzleProgress(payload))
      .filter((progress): progress is PuzzleProgressSnapshot => progress !== null);
  },
  async load(puzzleId) {
    const database = await getProgressDatabase();
    const row = await database.getFirstAsync<ProgressRow>(
      'SELECT payload FROM puzzle_progress WHERE puzzle_id = ?',
      puzzleId,
    );

    return row ? parsePuzzleProgress(row.payload) : null;
  },
  async remove(puzzleId) {
    const database = await getProgressDatabase();
    const clientUpdatedAt = new Date().toISOString();
    const deviceId = await getOrCreateProgressDeviceId(database);

    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM puzzle_progress WHERE puzzle_id = ?', puzzleId);
      await enqueueProgressEvent(database, {
        clientUpdatedAt,
        deviceId,
        eventId: randomUUID(),
        operation: 'delete',
        puzzleId,
      });
    });
  },
  async save(progress) {
    const database = await getProgressDatabase();
    const payload = serializePuzzleProgress(progress);
    const deviceId = await getOrCreateProgressDeviceId(database);
    const event: ProgressSyncEvent = {
      clientUpdatedAt: progress.updatedAt,
      deviceId,
      eventId: randomUUID(),
      operation: 'upsert',
      puzzleId: progress.puzzleId,
      snapshot: progress,
    };

    await database.withTransactionAsync(async () => {
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
      await enqueueProgressEvent(database, event);
    });
  },
};
