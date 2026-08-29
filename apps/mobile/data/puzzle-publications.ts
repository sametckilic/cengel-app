import type { PuzzlePublicationDescriptor } from '@cengel/contracts/puzzle-api';
import type { PuzzleDefinition } from '@cengel/puzzle-core/puzzle';

type ArchivePublication = Extract<
  PuzzlePublicationDescriptor,
  { channel: 'archive' }
>;
type PackPublication = Extract<
  PuzzlePublicationDescriptor,
  { channel: 'pack' }
>;

export type PublishedArchivePuzzle = {
  publication: ArchivePublication;
  puzzle: PuzzleDefinition;
};

export type PublishedPackPuzzle = {
  publication: PackPublication;
  puzzle: PuzzleDefinition;
};

function createPuzzleIndex(
  puzzles: readonly PuzzleDefinition[],
): ReadonlyMap<string, PuzzleDefinition> {
  return new Map(puzzles.map((puzzle) => [puzzle.id, puzzle]));
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function selectArchivePuzzles(
  puzzles: readonly PuzzleDefinition[],
  publications: readonly PuzzlePublicationDescriptor[],
): readonly PublishedArchivePuzzle[] {
  const puzzleById = createPuzzleIndex(puzzles);

  return publications
    .filter(
      (publication): publication is ArchivePublication =>
        publication.channel === 'archive',
    )
    .map((publication) => {
      const puzzle = puzzleById.get(publication.puzzleId);

      return puzzle ? { publication, puzzle } : undefined;
    })
    .filter(isPresent)
    .sort(
      (left, right) =>
        right.publication.publicationDate.localeCompare(
          left.publication.publicationDate,
        ) || left.puzzle.id.localeCompare(right.puzzle.id),
    );
}

export function selectPackPuzzles(
  puzzles: readonly PuzzleDefinition[],
  publications: readonly PuzzlePublicationDescriptor[],
  packId: string,
): readonly PublishedPackPuzzle[] {
  const puzzleById = createPuzzleIndex(puzzles);

  return publications
    .filter(
      (publication): publication is PackPublication =>
        publication.channel === 'pack' && publication.packId === packId,
    )
    .map((publication) => {
      const puzzle = puzzleById.get(publication.puzzleId);

      return puzzle ? { publication, puzzle } : undefined;
    })
    .filter(isPresent)
    .sort(
      (left, right) =>
        left.publication.puzzleNumber - right.publication.puzzleNumber,
    );
}
