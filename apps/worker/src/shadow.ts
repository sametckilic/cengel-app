import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { checksumJson } from './canonical-json';
import type { DailyPublication } from './types';

export type ShadowComparison = {
  date: string;
  generatedChecksum: string;
  matchesReference: boolean | null;
  referenceChecksum: string | null;
  status: 'matched' | 'missing-reference' | 'mismatch';
};

const REPOSITORY_ROOT = path.resolve(__dirname, '../../..');
const REFERENCE_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  'apps/mobile/data/generated/daily',
);

export function checksum(value: unknown): string {
  return checksumJson(value);
}

export function compareShadowPublication(
  generated: DailyPublication,
  reference: DailyPublication | null,
): ShadowComparison {
  const generatedChecksum = checksum(generated.puzzle);

  if (!reference) {
    return {
      date: generated.date,
      generatedChecksum,
      matchesReference: null,
      referenceChecksum: null,
      status: 'missing-reference',
    };
  }

  const referenceChecksum = checksum(reference.puzzle);
  const matchesReference = generatedChecksum === referenceChecksum;

  return {
    date: generated.date,
    generatedChecksum,
    matchesReference,
    referenceChecksum,
    status: matchesReference ? 'matched' : 'mismatch',
  };
}

export async function readReferencePublication(
  date: string,
): Promise<DailyPublication | null> {
  try {
    const contents = await readFile(
      path.join(REFERENCE_DIRECTORY, `gunun-${date}.json`),
      'utf8',
    );
    return JSON.parse(contents) as DailyPublication;
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null;
    }

    throw error;
  }
}
