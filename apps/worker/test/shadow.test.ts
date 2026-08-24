import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createScheduledDailyPublication } from '@cengel/generator/daily-puzzle-schedule';
import { describe, expect, it } from 'vitest';

import {
  compareShadowPublication,
  checksum,
} from '../src/shadow';
import type { ClueCatalog, DailyPublication } from '../src/types';

const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

describe('shadow generation', () => {
  it('reports catalog evolution against an immutable bundled publication', async () => {
    const [catalog, reference] = await Promise.all([
      readJson<ClueCatalog>(
        path.join(
          REPOSITORY_ROOT,
          'apps/mobile/data/generated/clue-catalog.json',
        ),
      ),
      readJson<DailyPublication>(
        path.join(
          REPOSITORY_ROOT,
          'apps/mobile/data/generated/daily/gunun-2026-08-25.json',
        ),
      ),
    ]);
    const generated = createScheduledDailyPublication(catalog, {
      date: reference.date,
      revision: 'schedule-v1',
    });

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
