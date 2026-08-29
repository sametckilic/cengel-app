import { describe, expect, it } from 'vitest';

import {
  compareShadowPublication,
  checksum,
} from '../src/shadow';
import type { DailyPublication } from '../src/types';

describe('shadow generation', () => {
  it('reports a generated puzzle that differs from its shadow reference', () => {
    const reference = {
      date: '2026-08-25',
      profileId: 'reference-profile',
      puzzle: {
        categories: ['turkce'],
        columnCount: 7,
        difficulty: 'beginner',
        id: 'shadow-reference',
        rowCount: 7,
        title: 'Referans',
        words: [],
      },
      quality: { issues: [], passed: true },
      recipe: { seed: 'reference-seed' },
      revision: 'reference-v2',
      schemaVersion: 1,
    } satisfies DailyPublication;
    const generated = {
      ...reference,
      puzzle: { ...reference.puzzle, title: 'Yeni üretim' },
    };

    expect(compareShadowPublication(generated, reference)).toEqual({
      date: reference.date,
      generatedChecksum: checksum(generated.puzzle),
      matchesReference: false,
      referenceChecksum: checksum(reference.puzzle),
      status: 'mismatch',
    });
  });

  it('reports missing references without treating them as mismatches', () => {
    const publication = {
      date: '2026-08-31',
      profileId: 'example',
      puzzle: {
        categories: ['turkce'],
        columnCount: 8,
        difficulty: 'easy',
        id: 'gunun-2026-08-31',
        rowCount: 8,
        title: 'Günün Bulmacası',
        words: [],
      },
      quality: { issues: [], passed: true },
      recipe: { seed: 'seed' },
      revision: 'schedule-v1-a1',
      schemaVersion: 1,
    } satisfies DailyPublication;

    expect(compareShadowPublication(publication, null).status).toBe(
      'missing-reference',
    );
  });
});
