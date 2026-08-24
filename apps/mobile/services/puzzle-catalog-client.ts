import { Platform } from 'react-native';

import {
  isPuzzleCatalogApiResponse,
  type PuzzleCatalogApiResponse,
} from '@cengel/contracts/puzzle-api';

export type PuzzleCatalogFetchResult =
  | { status: 'not-modified' }
  | { status: 'unavailable' }
  | {
      entityTag?: string;
      response: PuzzleCatalogApiResponse;
      status: 'updated';
    };

export function getPuzzleCatalogApiUrl(): string | null {
  const configuredOrigin = process.env.EXPO_PUBLIC_PUZZLE_API_URL?.trim();

  if (configuredOrigin) {
    return new URL(
      'v1/puzzles/catalog',
      `${configuredOrigin.replace(/\/$/, '')}/`,
    ).toString();
  }

  return Platform.OS === 'web' ? '/api/puzzles' : null;
}

export async function fetchPuzzleCatalog(
  entityTag?: string,
  signal?: AbortSignal,
): Promise<PuzzleCatalogFetchResult> {
  const url = getPuzzleCatalogApiUrl();

  if (!url) {
    return { status: 'unavailable' };
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(entityTag ? { 'If-None-Match': entityTag } : {}),
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

  return {
    entityTag: response.headers.get('ETag') ?? undefined,
    response: value,
    status: 'updated',
  };
}
