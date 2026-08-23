import { isPuzzleCatalogApiResponse } from '@/services/puzzle-api-contract';
import type { PuzzleCatalogApiResponse } from '@/services/puzzle-api-contract';

export type PuzzleCatalogCacheSnapshot = PuzzleCatalogApiResponse & {
  cachedAt: string;
};

export type PuzzleCatalogCacheStore = {
  load: () => Promise<PuzzleCatalogCacheSnapshot | null>;
  save: (snapshot: PuzzleCatalogCacheSnapshot) => Promise<void>;
};

export function parsePuzzleCatalogCache(
  serialized: string,
): PuzzleCatalogCacheSnapshot | null {
  try {
    const value: unknown = JSON.parse(serialized);

    if (
      typeof value !== 'object' ||
      value === null ||
      !('cachedAt' in value) ||
      typeof value.cachedAt !== 'string' ||
      !isPuzzleCatalogApiResponse(value)
    ) {
      return null;
    }

    return value as PuzzleCatalogCacheSnapshot;
  } catch {
    return null;
  }
}

export function serializePuzzleCatalogCache(
  snapshot: PuzzleCatalogCacheSnapshot,
): string {
  return JSON.stringify(snapshot);
}
