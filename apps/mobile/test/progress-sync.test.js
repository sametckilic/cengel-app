const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isProgressSyncEvent,
  parseProgressSyncEvent,
  parseProgressSyncResponse,
} = require('../services/progress-sync.ts');

const snapshot = {
  entries: { 1: 'A' },
  puzzleId: 'example-puzzle',
  revealedWordIds: [],
  schemaVersion: 1,
  selection: { cellIndex: 1, wordId: 'word-1' },
  solvedWordIds: [],
  updatedAt: '2026-08-24T10:00:00.000Z',
};

test('accepts upsert and delete progress events', () => {
  const upsert = {
    clientUpdatedAt: snapshot.updatedAt,
    deviceId: 'device-1',
    eventId: 'event-1',
    operation: 'upsert',
    puzzleId: snapshot.puzzleId,
    snapshot,
  };
  const deletion = {
    clientUpdatedAt: '2026-08-24T10:01:00.000Z',
    deviceId: 'device-1',
    eventId: 'event-2',
    operation: 'delete',
    puzzleId: snapshot.puzzleId,
  };

  assert.equal(isProgressSyncEvent(upsert), true);
  assert.equal(isProgressSyncEvent(deletion), true);
  assert.deepEqual(parseProgressSyncEvent(JSON.stringify(upsert)), upsert);
});

test('rejects snapshots whose identity does not match the event', () => {
  assert.equal(
    isProgressSyncEvent({
      clientUpdatedAt: snapshot.updatedAt,
      deviceId: 'device-1',
      eventId: 'event-1',
      operation: 'upsert',
      puzzleId: 'different-puzzle',
      snapshot,
    }),
    false,
  );
});

test('validates sync responses before applying remote state', () => {
  const response = {
    acknowledgedEventIds: ['00000000-0000-4000-8000-000000000001'],
    changes: [
      {
        clientUpdatedAt: snapshot.updatedAt,
        deleted: false,
        deviceId: '00000000-0000-4000-8000-000000000002',
        puzzleId: snapshot.puzzleId,
        serverVersion: 2,
        snapshot,
        sourceEventId: '00000000-0000-4000-8000-000000000001',
      },
    ],
  };

  assert.deepEqual(parseProgressSyncResponse(response), response);
  assert.equal(
    parseProgressSyncResponse({
      ...response,
      changes: [{ ...response.changes[0], serverVersion: 0 }],
    }),
    null,
  );
});
