import { randomUUID } from 'expo-crypto';

import {
  createProgressRebaseEvents,
  parseProgressSyncEvent,
  type ProgressSyncEvent,
} from '@/services/progress-sync';
import type { PuzzleProgressSnapshot } from '@cengel/puzzle-core/puzzle-progress';

const DEVICE_KEY = 'cengel:device-id:v1';
const OUTBOX_KEY = 'cengel:progress-outbox:v1';
const SYNC_USER_KEY = 'cengel:sync-user-id:v1';
let memoryDeviceId: string | undefined;
let memoryOutbox: Record<string, ProgressSyncEvent> = {};
let memorySyncUserId: string | undefined;

function readOutbox(): Record<string, ProgressSyncEvent> {
  if (typeof window === 'undefined') {
    return memoryOutbox;
  }

  try {
    const serialized = window.localStorage.getItem(OUTBOX_KEY);
    const value: unknown = serialized ? JSON.parse(serialized) : {};

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).flatMap(([puzzleId, event]) => {
        const parsed = parseProgressSyncEvent(JSON.stringify(event));
        return parsed?.puzzleId === puzzleId ? [[puzzleId, parsed]] : [];
      }),
    );
  } catch {
    return {};
  }
}

function writeOutbox(outbox: Record<string, ProgressSyncEvent>): void {
  if (typeof window === 'undefined') {
    memoryOutbox = outbox;
    return;
  }

  window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox));
}

export function acknowledgeWebProgressEvents(eventIds: readonly string[]): void {
  const acknowledgedIds = new Set(eventIds);
  writeOutbox(
    Object.fromEntries(
      Object.entries(readOutbox()).filter(
        ([, event]) => !acknowledgedIds.has(event.eventId),
      ),
    ),
  );
}

export function enqueueWebProgressEvent(event: ProgressSyncEvent): void {
  writeOutbox({ ...readOutbox(), [event.puzzleId]: event });
}

export function getOrCreateWebProgressDeviceId(): string {
  if (typeof window === 'undefined') {
    memoryDeviceId ??= randomUUID();
    return memoryDeviceId;
  }

  const stored = window.localStorage.getItem(DEVICE_KEY);

  if (stored) {
    return stored;
  }

  const deviceId = randomUUID();
  window.localStorage.setItem(DEVICE_KEY, deviceId);
  return deviceId;
}

export function listWebProgressEvents(limit: number): readonly ProgressSyncEvent[] {
  return Object.values(readOutbox())
    .sort((left, right) => left.clientUpdatedAt.localeCompare(right.clientUpdatedAt))
    .slice(0, limit);
}

export function prepareWebProgressSyncUser(
  userId: string,
  snapshots: readonly PuzzleProgressSnapshot[],
): void {
  const currentUserId =
    typeof window === 'undefined'
      ? memorySyncUserId
      : (window.localStorage.getItem(SYNC_USER_KEY) ?? undefined);

  if (currentUserId === userId) {
    return;
  }

  const deviceId = randomUUID();
  const events = createProgressRebaseEvents(deviceId, snapshots, randomUUID);
  const outbox = Object.fromEntries(
    events.map((event) => [event.puzzleId, event]),
  );

  if (typeof window === 'undefined') {
    memoryDeviceId = deviceId;
    memoryOutbox = outbox;
    memorySyncUserId = userId;
    return;
  }

  window.localStorage.setItem(DEVICE_KEY, deviceId);
  window.localStorage.setItem(SYNC_USER_KEY, userId);
  writeOutbox(outbox);
}
