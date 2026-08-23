import type { PuzzleDefinition } from './puzzle';
import type { PuzzleInputState } from './puzzle-input';

export type RevealedWordResult = {
  inputState: PuzzleInputState;
  wordId: string;
};

export function revealPuzzleWord(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  state: PuzzleInputState,
  wordId: string,
): RevealedWordResult {
  const word = puzzle.words.find(({ id }) => id === wordId);

  if (!word) {
    throw new Error(`Puzzle is missing hint word "${wordId}".`);
  }

  return {
    inputState: {
      entries: {
        ...state.entries,
        ...Object.fromEntries(
          word.cellIndices.map((cellIndex, letterIndex) => [
            cellIndex,
            word.answer[letterIndex],
          ]),
        ),
      },
      selection: state.selection,
    },
    wordId: word.id,
  };
}

export function revealSelectedWord(
  puzzle: Pick<PuzzleDefinition, 'words'>,
  state: PuzzleInputState,
): RevealedWordResult {
  return revealPuzzleWord(puzzle, state, state.selection.wordId);
}
