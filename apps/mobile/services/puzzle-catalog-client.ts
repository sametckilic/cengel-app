import { Platform } from 'react-native';

import {
  isPuzzleCatalogApiResponse,
  type PuzzleCatalogApiResponse,
} from '@cengel/contracts/puzzle-api';

export type PuzzleCatalogFetchResult =
  | { status: 'not-modified' }
  | { status: 'unavailable' }
  | { response: PuzzleCatalogApiResponse; status: 'updated' };

export function getPuzzleCatalogApiUrl(): string | null {
  const configuredOrigin = process.env.EXPO_PUBLIC_PUZZLE_API_URL?.trim();

  if (configuredOrigin) {
    return new URL('api/puzzles', `${configuredOrigin.replace(/\/$/, '')}/`).toString();
  }

  return Platform.OS === 'web' ? '/api/puzzles' : null;
}

export async function fetchPuzzleCatalog(
  catalogVersion?: string,
  signal?: AbortSignal,
): Promise<PuzzleCatalogFetchResult> {
  const url = getPuzzleCatalogApiUrl();

  if (!url) {
    return { status: 'unavailable' };
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(catalogVersion ? { 'If-None-Match': `"${catalogVersion}"` } : {}),
    },
    signal,
  });

  if (response.status === 304) {
    return { status: 'not-modified' };
  }

  if (!response.ok) {
    throw new Error(`Puzzle catalog request failed with status ${response.status}.`);
  }

  const value: unknown = await response.json();

  if (!isPuzzleCatalogApiResponse(value)) {
    throw new Error('Puzzle catalog API returned an invalid response.');
  }

  return { response: value, status: 'updated' };
}
