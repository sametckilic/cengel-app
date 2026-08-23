import type { PuzzleDefinition, PuzzleWord } from '@/types/puzzle';

export type PuzzleSelection = {
  cellIndex: number;
  wordId: string;
};

export function getWordsAtCell(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  cellIndex: number,
): readonly PuzzleWord[] {
  return puzzle.words.filter((word) => word.cellIndices.includes(cellIndex));
}

export function getSelectedWord(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  selection: PuzzleSelection,
): PuzzleWord {
  const word = puzzle.words.find(({ id }) => id === selection.wordId);

  if (!word) {
    throw new Error(`Puzzle is missing selected word "${selection.wordId}".`);
  }

  return word;
}

export function createInitialPuzzleSelection(
  puzzle: Pick<PuzzleDefinition, 'initialSelection' | 'words'>,
): PuzzleSelection {
  const selection = { ...puzzle.initialSelection };
  const word = getSelectedWord(puzzle, selection);

  if (!word.cellIndices.includes(selection.cellIndex)) {
    throw new Error(
      `Initial cell ${selection.cellIndex} is not part of word "${selection.wordId}".`,
    );
  }

  return selection;
}

export function selectPuzzleCell(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  currentSelection: PuzzleSelection,
  cellIndex: number,
): PuzzleSelection {
  const candidateWords = getWordsAtCell(puzzle, cellIndex);

  if (candidateWords.length === 0) {
    return currentSelection;
  }

  const currentWord = getSelectedWord(puzzle, currentSelection);
  const currentCandidateIndex = candidateWords.findIndex(({ id }) => id === currentWord.id);

  if (
    cellIndex === currentSelection.cellIndex &&
    candidateWords.length > 1 &&
    currentCandidateIndex >= 0
  ) {
    const nextWord = candidateWords[(currentCandidateIndex + 1) % candidateWords.length];
    return { cellIndex, wordId: nextWord.id };
  }

  if (currentCandidateIndex >= 0) {
    return { cellIndex, wordId: currentWord.id };
  }

  const sameDirectionWord = candidateWords.find(
    ({ direction }) => direction === currentWord.direction,
  );
  const nextWord = sameDirectionWord ?? candidateWords[0];

  return { cellIndex, wordId: nextWord.id };
}
