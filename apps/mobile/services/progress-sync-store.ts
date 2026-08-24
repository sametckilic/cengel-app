import type { SQLiteDatabase } from 'expo-sqlite';

import {
  parseProgressSyncEvent,
  type ProgressSyncEvent,
  type ProgressSyncOutboxStore,
} from '@/services/progress-sync';
import {
  getOrCreateProgressDeviceId,
  getProgressDatabase,
} from '@/services/puzzle-progress-store';

type OutboxRow = {
  payload: string;
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
};
