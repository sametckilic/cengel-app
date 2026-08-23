import type { PuzzleDefinition, PuzzleEntries, PuzzleWord } from '@/types/puzzle';
import type { PuzzleSelection } from '@/utils/puzzle-selection';

export type WordValidationStatus = 'correct' | 'incomplete' | 'incorrect';

export type WordValidationResult = {
  status: WordValidationStatus;
  wordId: string;
};

export function validateSelectedWord(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  entries: PuzzleEntries,
  selection: PuzzleSelection,
): WordValidationResult {
  const word = puzzle.words.find(({ id }) => id === selection.wordId);

  if (!word) {
    throw new Error(`Puzzle is missing selected word "${selection.wordId}".`);
  }

  const enteredLetters = word.cellIndices.map((cellIndex) => entries[cellIndex]);

  if (enteredLetters.some((letter) => !letter)) {
    return { status: 'incomplete', wordId: word.id };
  }

  return {
    status: enteredLetters.join('') === word.answer ? 'correct' : 'incorrect',
    wordId: word.id,
  };
}

export function getLockedCellIndices(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  solvedWordIds: ReadonlySet<string>,
): ReadonlySet<number> {
  return new Set(
    puzzle.words.flatMap((word) =>
      solvedWordIds.has(word.id) ? [...word.cellIndices] : [],
    ),
  );
}

export function isPuzzleComplete(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  solvedWordIds: ReadonlySet<string>,
): boolean {
  return (
    puzzle.words.length > 0 &&
    puzzle.words.every(({ id }) => solvedWordIds.has(id))
  );
}

export function getLockedWordPattern(
  word: Pick<PuzzleWord, 'cellIndices'>,
  entries: PuzzleEntries,
  lockedCellIndices: ReadonlySet<number>,
): readonly (string | undefined)[] {
  return word.cellIndices.map((cellIndex) =>
    lockedCellIndices.has(cellIndex) ? entries[cellIndex] : undefined,
  );
}
