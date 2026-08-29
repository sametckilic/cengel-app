import { describe, expect, it } from 'vitest';

import {
  createArchivePublicationTarget,
  createDailyPublicationTarget,
  createPackPublicationTarget,
  createPublicationInsertParameters,
  requestHash,
  toAlreadyPublishedResult,
} from '../src/publisher';

describe('publication access targets', () => {
  it('writes free access for the daily publication', () => {
    const target = createDailyPublicationTarget('2026-08-31');

    expect(createPublicationInsertParameters(target, 'puzzle-record')).toEqual([
      '2026-08-31',
      'daily',
      'puzzle-record',
      null,
    ]);
  });

  it('writes premium access for archive publications', () => {
    const target = createArchivePublicationTarget(
      '2026-08-31',
      'archive-easy-001',
    );

    expect(createPublicationInsertParameters(target, 'puzzle-record')).toEqual([
      '2026-08-31',
      'archive:archive-easy-001',
      'puzzle-record',
      'premium_access',
    ]);
  });

  it('writes free access only for the first puzzle in a pack', () => {
    expect(
      createPublicationInsertParameters(
        createPackPublicationTarget('2026-08-31', 'edebiyat', 1),
        'first-record',
      ),
    ).toEqual([
      '2026-08-31',
      'pack:edebiyat:1',
      'first-record',
      null,
    ]);
    expect(
      createPublicationInsertParameters(
        createPackPublicationTarget('2026-08-31', 'edebiyat', 2),
        'second-record',
      ),
    ).toEqual([
      '2026-08-31',
      'pack:edebiyat:2',
      'second-record',
      'premium_access',
    ]);
  });

  it('rejects unsafe publication key segments', () => {
    expect(() =>
      createArchivePublicationTarget('2026-08-31', 'Archive 1'),
    ).toThrow('Archive puzzle ID must use lowercase letters, numbers, and hyphens.');
    expect(() =>
      createPackPublicationTarget('2026-08-31', 'edebiyat:ozel', 1),
    ).toThrow('Pack ID must use lowercase letters, numbers, and hyphens.');
  });
});

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
      publicationKey: 'daily',
      revision: 'schedule-v1-a1',
      seed: 'seed',
    };

    expect(requestHash(base)).not.toBe(
      requestHash({ ...base, revision: 'schedule-v2-a1' }),
    );
    expect(requestHash(base)).not.toBe(
      requestHash({ ...base, publicationKey: 'archive:archive-easy-001' }),
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
        createDailyPublicationTarget('2026-08-26'),
      ),
    ).toEqual({
      checksum: 'original-checksum',
      date: '2026-08-26',
      publicationKey: 'daily',
      puzzleId: 'gunun-2026-08-26',
      status: 'already-published',
      version: 1,
    });
  });
});
