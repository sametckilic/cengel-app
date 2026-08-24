import { Platform } from 'react-native';

import { getPuzzleApiOrigin } from '@/services/puzzle-catalog-client';
import {
  parseProgressSyncResponse,
  type ProgressSyncEvent,
} from '@/services/progress-sync';
import { progressSyncOutboxStore } from '@/services/progress-sync-store';

const BATCH_SIZE = 50;

type SyncPlatform = 'android' | 'ios' | 'web';

function getSyncPlatform(): SyncPlatform | null {
  return Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web'
    ? Platform.OS
    : null;
}

export async function synchronizeProgress(
  accessToken: string,
): Promise<{ sentEventCount: number; status: 'synced' | 'unavailable' }> {
  const origin = getPuzzleApiOrigin();
  const platform = getSyncPlatform();

  if (!origin || !platform) {
    return { sentEventCount: 0, status: 'unavailable' };
  }

  const [deviceId, events] = await Promise.all([
    progressSyncOutboxStore.getDeviceId(),
    progressSyncOutboxStore.list(BATCH_SIZE),
  ]);
  const response = await fetch(
    new URL('v1/progress/sync', `${origin.replace(/\/$/, '')}/`).toString(),
    {
      body: JSON.stringify({
        device: { id: deviceId, platform },
        events: events satisfies readonly ProgressSyncEvent[],
      }),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    },
  );

  if (!response.ok) {
    throw new Error(`Progress sync failed with status ${response.status}.`);
  }

  const result = parseProgressSyncResponse(await response.json());

  if (!result) {
    throw new Error('Progress sync API returned an invalid response.');
  }

  await progressSyncOutboxStore.applyChanges(result.changes);
  await progressSyncOutboxStore.acknowledge(result.acknowledgedEventIds);

  return { sentEventCount: events.length, status: 'synced' };
}
