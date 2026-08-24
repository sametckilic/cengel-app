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

export type ProgressSyncChange = {
  clientUpdatedAt: string;
  deleted: boolean;
  deviceId: string;
  puzzleId: string;
  serverVersion: number;
  snapshot: PuzzleProgressSnapshot | null;
  sourceEventId: string;
};

export type ProgressSyncResponse = {
  acknowledgedEventIds: readonly string[];
  changes: readonly ProgressSyncChange[];
};

export type ProgressSyncOutboxStore = {
  acknowledge(eventIds: readonly string[]): Promise<void>;
  applyChanges(changes: readonly ProgressSyncChange[]): Promise<void>;
  getDeviceId(): Promise<string>;
  list(limit?: number): Promise<readonly ProgressSyncEvent[]>;
};

const outboxListeners = new Set<() => void>();

export function notifyProgressOutboxChanged(): void {
  outboxListeners.forEach((listener) => listener());
}

export function subscribeProgressOutbox(listener: () => void): () => void {
  outboxListeners.add(listener);
  return () => outboxListeners.delete(listener);
}

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

function isProgressSyncChange(value: unknown): value is ProgressSyncChange {
  if (
    !isRecord(value) ||
    typeof value.clientUpdatedAt !== 'string' ||
    Number.isNaN(Date.parse(value.clientUpdatedAt)) ||
    typeof value.deleted !== 'boolean' ||
    typeof value.deviceId !== 'string' ||
    typeof value.puzzleId !== 'string' ||
    !Number.isInteger(value.serverVersion) ||
    Number(value.serverVersion) < 1 ||
    typeof value.sourceEventId !== 'string'
  ) {
    return false;
  }

  return value.deleted
    ? value.snapshot === null
    : isPuzzleProgressSnapshot(value.snapshot) &&
        value.snapshot.puzzleId === value.puzzleId &&
        value.snapshot.updatedAt === value.clientUpdatedAt;
}

export function parseProgressSyncResponse(value: unknown): ProgressSyncResponse | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.acknowledgedEventIds) ||
    !value.acknowledgedEventIds.every((eventId) => typeof eventId === 'string') ||
    !Array.isArray(value.changes) ||
    !value.changes.every(isProgressSyncChange)
  ) {
    return null;
  }

  return {
    acknowledgedEventIds: value.acknowledgedEventIds,
    changes: value.changes,
  };
}
