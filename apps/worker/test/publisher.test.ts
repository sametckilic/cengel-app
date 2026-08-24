import { describe, expect, it } from 'vitest';

import { requestHash, toAlreadyPublishedResult } from '../src/publisher';

describe('publisher request identity', () => {
  it('is deterministic regardless of input key order', () => {
    expect(
      requestHash({
        catalogChecksum: 'catalog',
        date: '2026-08-31',
        revision: 'schedule-v1-a1',
        seed: 'seed',
      }),
    ).toBe(
      requestHash({
        seed: 'seed',
        revision: 'schedule-v1-a1',
        date: '2026-08-31',
        catalogChecksum: 'catalog',
      }),
    );
  });

  it('changes when generation identity changes', () => {
    const base = {
      catalogChecksum: 'catalog',
      date: '2026-08-31',
      revision: 'schedule-v1-a1',
      seed: 'seed',
    };

    expect(requestHash(base)).not.toBe(
      requestHash({ ...base, revision: 'schedule-v2-a1' }),
    );
  });
});

describe('published daily puzzle immutability', () => {
  it('keeps the existing publication when the clue catalog changes', () => {
    expect(
      toAlreadyPublishedResult(
        {
          checksum: 'original-checksum',
          puzzle_id: 'gunun-2026-08-26',
          version: 1,
        },
        '2026-08-26',
      ),
    ).toEqual({
      checksum: 'original-checksum',
      date: '2026-08-26',
      puzzleId: 'gunun-2026-08-26',
      status: 'already-published',
      version: 1,
    });
  });
});
