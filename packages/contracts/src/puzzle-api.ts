import {
  isPuzzleDefinition,
  isPuzzleManifest,
} from '@cengel/puzzle-core/puzzle-schema';
import type {
  PuzzleDefinition,
  PuzzleManifest,
} from '@cengel/puzzle-core/puzzle';

export const PUZZLE_API_VERSION = 1 as const;

export type PuzzleCatalogApiResponse = {
  apiVersion: typeof PUZZLE_API_VERSION;
  catalogVersion: string;
  manifest: PuzzleManifest;
};

export type PuzzleApiResponse = {
  apiVersion: typeof PUZZLE_API_VERSION;
  catalogVersion: string;
  puzzle: PuzzleDefinition;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hashCatalog(manifest: PuzzleManifest): string {
  const signature = manifest.puzzles
    .map((puzzle) => [puzzle.id, puzzle.generation?.seed ?? '', puzzle.words.length].join(':'))
    .join('|');
  let hash = 2166136261;

  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `catalog-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createPuzzleCatalogApiResponse(
  manifest: PuzzleManifest,
): PuzzleCatalogApiResponse {
  return {
    apiVersion: PUZZLE_API_VERSION,
    catalogVersion: hashCatalog(manifest),
    manifest,
  };
}

export function createPuzzleApiResponse(
  puzzle: PuzzleDefinition,
  catalogVersion: string,
): PuzzleApiResponse {
  return {
    apiVersion: PUZZLE_API_VERSION,
    catalogVersion,
    puzzle,
  };
}

export function isPuzzleCatalogApiResponse(
  value: unknown,
): value is PuzzleCatalogApiResponse {
  return (
    isRecord(value) &&
    value.apiVersion === PUZZLE_API_VERSION &&
    typeof value.catalogVersion === 'string' &&
    value.catalogVersion.length > 0 &&
    isPuzzleManifest(value.manifest)
  );
}

export function isPuzzleApiResponse(value: unknown): value is PuzzleApiResponse {
  return (
    isRecord(value) &&
    value.apiVersion === PUZZLE_API_VERSION &&
    typeof value.catalogVersion === 'string' &&
    value.catalogVersion.length > 0 &&
    isPuzzleDefinition(value.puzzle)
  );
}
