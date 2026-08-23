import type { PuzzleDefinition, PuzzleEntries, PuzzleWord } from '@/types/puzzle';
import type { PuzzleSelection } from '@/utils/puzzle-selection';

const SUPPORTED_LETTER_PATTERN = /^[A-ZÇĞİÖŞÜ]$/;

export type PuzzleInputState = {
  entries: PuzzleEntries;
  selection: PuzzleSelection;
};

function getActiveWord(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  selection: PuzzleSelection,
): PuzzleWord {
  const word = puzzle.words.find(({ id }) => id === selection.wordId);

  if (!word || !word.cellIndices.includes(selection.cellIndex)) {
    throw new Error('Puzzle input selection must point to a cell in its active word.');
  }

  return word;
}

export function normalizePuzzleLetter(letter: string): string {
  const normalizedLetter = letter.toLocaleUpperCase('tr-TR');

  if (!SUPPORTED_LETTER_PATTERN.test(normalizedLetter)) {
    throw new Error(`Unsupported puzzle letter: ${letter}`);
  }

  return normalizedLetter;
}

export function beginPuzzleWordEntry(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  state: PuzzleInputState,
  lockedCellIndices: ReadonlySet<number> = new Set(),
): PuzzleInputState {
  const activeWord = getActiveWord(puzzle, state.selection);
  const firstEditableCellIndex = activeWord.cellIndices.find(
    (cellIndex) => !lockedCellIndices.has(cellIndex),
  );

  if (
    firstEditableCellIndex === undefined ||
    firstEditableCellIndex === state.selection.cellIndex
  ) {
    return state;
  }

  return {
    ...state,
    selection: {
      ...state.selection,
      cellIndex: firstEditableCellIndex,
    },
  };
}

export function enterPuzzleLetter(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  state: PuzzleInputState,
  letter: string,
  lockedCellIndices: ReadonlySet<number> = new Set(),
): PuzzleInputState {
  const activeWord = getActiveWord(puzzle, state.selection);
  const activePosition = activeWord.cellIndices.indexOf(state.selection.cellIndex);
  const targetPosition = activeWord.cellIndices.findIndex(
    (cellIndex, position) => position >= activePosition && !lockedCellIndices.has(cellIndex),
  );

  if (targetPosition < 0) {
    return state;
  }

  const targetCellIndex = activeWord.cellIndices[targetPosition];
  const nextEditablePosition = activeWord.cellIndices.findIndex(
    (cellIndex, position) => position > targetPosition && !lockedCellIndices.has(cellIndex),
  );
  const nextCellIndex =
    nextEditablePosition >= 0
      ? activeWord.cellIndices[nextEditablePosition]
      : targetCellIndex;

  return {
    entries: {
      ...state.entries,
      [targetCellIndex]: normalizePuzzleLetter(letter),
    },
    selection: {
      ...state.selection,
      cellIndex: nextCellIndex,
    },
  };
}

export function backspacePuzzleEntry(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  state: PuzzleInputState,
  lockedCellIndices: ReadonlySet<number> = new Set(),
): PuzzleInputState {
  const activeWord = getActiveWord(puzzle, state.selection);

  if (
    !lockedCellIndices.has(state.selection.cellIndex) &&
    state.entries[state.selection.cellIndex]
  ) {
    return {
      entries: { ...state.entries, [state.selection.cellIndex]: undefined },
      selection: state.selection,
    };
  }

  const activePosition = activeWord.cellIndices.indexOf(state.selection.cellIndex);

  const previousEditablePositions = activeWord.cellIndices.flatMap((cellIndex, position) =>
    position < activePosition && !lockedCellIndices.has(cellIndex) ? [position] : [],
  );

  if (previousEditablePositions.length === 0) {
    return state;
  }

  const previousCellIndex =
    activeWord.cellIndices[previousEditablePositions[previousEditablePositions.length - 1]];

  return {
    entries: { ...state.entries, [previousCellIndex]: undefined },
    selection: { ...state.selection, cellIndex: previousCellIndex },
  };
}
