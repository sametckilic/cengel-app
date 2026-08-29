import {
  isPuzzleDefinition,
  isPuzzleManifest,
} from '@cengel/puzzle-core/puzzle-schema';
import type {
  PuzzleDefinition,
  PuzzleManifest,
} from '@cengel/puzzle-core/puzzle';

export const PUZZLE_API_VERSION = 1 as const;

type PuzzlePublicationBase = {
  publicationDate: string;
  puzzleId: string;
  requiredEntitlement: string | null;
};

export type PuzzlePublicationDescriptor =
  | (PuzzlePublicationBase & { channel: 'archive' })
  | (PuzzlePublicationBase & { channel: 'daily' })
  | (PuzzlePublicationBase & {
      channel: 'pack';
      packId: string;
      puzzleNumber: number;
    });

export type PuzzlePublicationRecord = PuzzlePublicationBase & {
  publicationKey: string;
};

export type PuzzleCatalogApiResponse = {
  apiVersion: typeof PUZZLE_API_VERSION;
  catalogVersion: string;
  manifest: PuzzleManifest;
  publications: readonly PuzzlePublicationDescriptor[];
};

export type PuzzleApiResponse = {
  apiVersion: typeof PUZZLE_API_VERSION;
  catalogVersion: string;
  puzzle: PuzzleDefinition;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hashCatalog(
  manifest: PuzzleManifest,
  publications: readonly PuzzlePublicationDescriptor[],
): string {
  const puzzleSignature = manifest.puzzles
    .map((puzzle) => [puzzle.id, puzzle.generation?.seed ?? '', puzzle.words.length].join(':'));
  const publicationSignature = publications.map((publication) =>
    [
      publication.channel,
      publication.puzzleId,
      publication.publicationDate,
      publication.requiredEntitlement ?? '',
      publication.channel === 'pack' ? publication.packId : '',
      publication.channel === 'pack' ? publication.puzzleNumber : '',
    ].join(':'),
  );
  const signature = [...puzzleSignature, ...publicationSignature].join('|');
  let hash = 2166136261;

  for (let index = 0; index < signature.length; index += 1) {
    hash ^= signature.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `catalog-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function createPuzzleCatalogApiResponse(
  manifest: PuzzleManifest,
  publications: readonly PuzzlePublicationDescriptor[] = [],
): PuzzleCatalogApiResponse {
  return {
    apiVersion: PUZZLE_API_VERSION,
    catalogVersion: hashCatalog(manifest, publications),
    manifest,
    publications,
  };
}

export function createPuzzlePublicationDescriptor(
  record: PuzzlePublicationRecord,
): PuzzlePublicationDescriptor {
  if (
    typeof record.publicationDate !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(record.publicationDate) ||
    typeof record.puzzleId !== 'string' ||
    record.puzzleId.length === 0 ||
    !(
      record.requiredEntitlement === null ||
      (typeof record.requiredEntitlement === 'string' &&
        record.requiredEntitlement.length > 0)
    )
  ) {
    throw new Error('Puzzle publication record is invalid.');
  }

  const base: PuzzlePublicationBase = {
    publicationDate: record.publicationDate,
    puzzleId: record.puzzleId,
    requiredEntitlement: record.requiredEntitlement,
  };

  if (record.publicationKey === 'daily') {
    if (record.puzzleId !== `gunun-${record.publicationDate}`) {
      throw new Error('Daily publication identity is inconsistent.');
    }

    return { ...base, channel: 'daily' };
  }

  if (record.publicationKey === `archive:${record.puzzleId}`) {
    return { ...base, channel: 'archive' };
  }

  const packMatch = /^pack:([a-z0-9][a-z0-9-]*):([1-9]\d*)$/.exec(
    record.publicationKey,
  );

  if (packMatch) {
    return {
      ...base,
      channel: 'pack',
      packId: packMatch[1],
      puzzleNumber: Number(packMatch[2]),
    };
  }

  throw new Error(`Unsupported puzzle publication key: ${record.publicationKey}`);
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
  if (
    !isRecord(value) ||
    value.apiVersion !== PUZZLE_API_VERSION ||
    typeof value.catalogVersion !== 'string' ||
    value.catalogVersion.length === 0 ||
    !isPuzzleManifest(value.manifest) ||
    !Array.isArray(value.publications) ||
    !value.publications.every(isPuzzlePublicationDescriptor)
  ) {
    return false;
  }

  const publications: readonly PuzzlePublicationDescriptor[] =
    value.publications;
  const puzzleIds = new Set(value.manifest.puzzles.map((puzzle) => puzzle.id));

  return (
    new Set(publications.map((publication) => publication.puzzleId)).size ===
      publications.length &&
    publications.every((publication) => puzzleIds.has(publication.puzzleId))
  );
}

export function isPuzzlePublicationDescriptor(
  value: unknown,
): value is PuzzlePublicationDescriptor {
  if (
    !isRecord(value) ||
    typeof value.puzzleId !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(value.publicationDate)) ||
    !(
      value.requiredEntitlement === null ||
      (typeof value.requiredEntitlement === 'string' &&
        value.requiredEntitlement.length > 0)
    )
  ) {
    return false;
  }

  if (value.channel === 'daily') {
    return value.puzzleId === `gunun-${String(value.publicationDate)}`;
  }

  if (value.channel === 'archive') {
    return true;
  }

  return (
    value.channel === 'pack' &&
    typeof value.packId === 'string' &&
    /^[a-z0-9][a-z0-9-]*$/.test(value.packId) &&
    Number.isSafeInteger(value.puzzleNumber) &&
    Number(value.puzzleNumber) > 0
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
