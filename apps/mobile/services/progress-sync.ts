import {
  isPuzzleProgressSnapshot,
  type PuzzleProgressSnapshot,
} from '@cengel/puzzle-core/puzzle-progress';

type ProgressSyncEventBase = {
  clientUpdatedAt: string;
  deviceId: string;
  eventId: string;
  puzzleId: string;
};

export type ProgressSyncEvent =
  | (ProgressSyncEventBase & {
      operation: 'delete';
    })
  | (ProgressSyncEventBase & {
      operation: 'upsert';
      snapshot: PuzzleProgressSnapshot;
    });

export type ProgressSyncOutboxStore = {
  acknowledge(eventIds: readonly string[]): Promise<void>;
  getDeviceId(): Promise<string>;
  list(limit?: number): Promise<readonly ProgressSyncEvent[]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isProgressSyncEvent(value: unknown): value is ProgressSyncEvent {
  if (
    !isRecord(value) ||
    typeof value.clientUpdatedAt !== 'string' ||
    Number.isNaN(Date.parse(value.clientUpdatedAt)) ||
    typeof value.deviceId !== 'string' ||
    value.deviceId.length === 0 ||
    typeof value.eventId !== 'string' ||
    value.eventId.length === 0 ||
    typeof value.puzzleId !== 'string' ||
    value.puzzleId.length === 0
  ) {
    return false;
  }

  if (value.operation === 'delete') {
    return true;
  }

  return (
    value.operation === 'upsert' &&
    isPuzzleProgressSnapshot(value.snapshot) &&
    value.snapshot.puzzleId === value.puzzleId &&
    value.snapshot.updatedAt === value.clientUpdatedAt
  );
}

export function parseProgressSyncEvent(serialized: string): ProgressSyncEvent | null {
  try {
    const value: unknown = JSON.parse(serialized);
    return isProgressSyncEvent(value) ? value : null;
  } catch {
    return null;
  }
}
