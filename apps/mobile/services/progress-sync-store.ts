import type { SQLiteDatabase } from 'expo-sqlite';
import { randomUUID } from 'expo-crypto';

import {
  createProgressRebaseEvents,
  parseProgressSyncEvent,
  type ProgressSyncEvent,
  type ProgressSyncOutboxStore,
} from '@/services/progress-sync';
import {
  applyRemoteProgressChanges,
  getOrCreateProgressDeviceId,
  getProgressDatabase,
} from '@/services/puzzle-progress-store';

type OutboxRow = {
  payload: string;
};

type MetadataRow = {
  value: string;
};

async function acknowledgeEvents(
  database: SQLiteDatabase,
  eventIds: readonly string[],
): Promise<void> {
  if (eventIds.length === 0) {
    return;
  }

  const placeholders = eventIds.map(() => '?').join(', ');
  await database.runAsync(
    `DELETE FROM progress_sync_outbox WHERE event_id IN (${placeholders})`,
    ...eventIds,
  );
}

export const progressSyncOutboxStore: ProgressSyncOutboxStore = {
  async acknowledge(eventIds) {
    await acknowledgeEvents(await getProgressDatabase(), eventIds);
  },
  async applyChanges(changes) {
    await applyRemoteProgressChanges(changes);
  },
  async getDeviceId() {
    const database = await getProgressDatabase();
    return getOrCreateProgressDeviceId(database);
  },
  async list(limit = 50) {
    const database = await getProgressDatabase();
    const rows = await database.getAllAsync<OutboxRow>(
      `SELECT payload
       FROM progress_sync_outbox
       ORDER BY created_at ASC
       LIMIT ?`,
      limit,
    );

    return rows
      .map(({ payload }) => parseProgressSyncEvent(payload))
      .filter((event): event is ProgressSyncEvent => event !== null);
  },
  async prepareForUser(userId, snapshots) {
    const database = await getProgressDatabase();
    const owner = await database.getFirstAsync<MetadataRow>(
      "SELECT value FROM progress_metadata WHERE key = 'sync-user-id'",
    );

    if (owner?.value === userId) {
      return;
    }

    const deviceId = randomUUID();
    const events = createProgressRebaseEvents(deviceId, snapshots, randomUUID);

    await database.withTransactionAsync(async () => {
      await database.runAsync('DELETE FROM progress_sync_outbox');
      await database.runAsync(
        `INSERT INTO progress_metadata (key, value) VALUES ('device-id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        deviceId,
      );
      await database.runAsync(
        `INSERT INTO progress_metadata (key, value) VALUES ('sync-user-id', ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        userId,
      );

      for (const event of events) {
        await database.runAsync(
          `INSERT INTO progress_sync_outbox (puzzle_id, event_id, payload, created_at)
           VALUES (?, ?, ?, ?)`,
          event.puzzleId,
          event.eventId,
          JSON.stringify(event),
          event.clientUpdatedAt,
        );
      }
    });
  },
};
