import type { GameplayDifficulty } from './clue-catalog';

export type PuzzleDirection = 'down' | 'right';

export type PuzzleClueSummary = {
  direction: PuzzleDirection;
  label: string;
};

export type PuzzleCell =
  | { type: 'void' }
  | ({ type: 'clue' } & PuzzleClueSummary)
  | { type: 'split-clue'; clues: readonly [PuzzleClueSummary, PuzzleClueSummary] }
  | { type: 'letter'; initialValue?: string };

export type NewspaperPuzzleCell = Exclude<PuzzleCell, { type: 'void' }>;

export type PuzzleWord = {
  answer: string;
  category: string;
  cellIndices: readonly number[];
  clue: string;
  direction: PuzzleDirection;
  id: string;
};

export type PuzzleDefinition = {
  categories: readonly string[];
  cells: readonly PuzzleCell[];
  columnCount: number;
  difficulty: GameplayDifficulty;
  id: string;
  generation?: {
    aestheticScore?: number;
    categoryWeight: number;
    generatorVersion?: 'newspaper-v2';
    intersectionCount: number;
    seed: string;
    targetWordCount: number;
    topologyFingerprint?: string;
    topologyId?: string;
  };
  initialSelection: {
    cellIndex: number;
    wordId: string;
  };
  rowCount: number;
  title: string;
  words: readonly PuzzleWord[];
};

export type NewspaperPuzzleDefinition = Omit<PuzzleDefinition, 'cells'> & {
  cells: readonly NewspaperPuzzleCell[];
  format: 'newspaper-arrowword';
};

export type PuzzleGenerationRequest = {
  categories: readonly string[];
  categoryWeight: number;
  columnCount: number;
  difficulty: GameplayDifficulty;
  rowCount: number;
  seed: string;
  targetWordCount: number;
};

export type PuzzleRecipe = PuzzleGenerationRequest &
  {
    id: string;
    title: string;
  } &
  (
    | { format?: undefined; topologyId?: undefined }
    | {
        format: 'newspaper-arrowword';
        generatorVersion?: 'newspaper-v1';
        topologyId: string;
      }
    | {
        format: 'newspaper-arrowword';
        generatorVersion: 'newspaper-v2';
        topologyId?: undefined;
      }
  );

export type GeneratedPuzzleLayout = Pick<
  PuzzleDefinition,
  'cells' | 'columnCount' | 'rowCount' | 'words'
> & {
  intersectionCount: number;
};

export type PuzzleManifest = {
  puzzles: readonly PuzzleDefinition[];
  rights: {
    basis: 'project-owned';
    confirmedAt: '2026-08-19';
  };
  schemaVersion: 1;
  sourceCatalog: string;
};

export type PuzzleEntries = Record<number, string | undefined>;

export function createInitialPuzzleEntries(puzzle: PuzzleDefinition): PuzzleEntries {
  return Object.fromEntries(
    puzzle.cells.flatMap((cell, index) =>
      cell.type === 'letter' && cell.initialValue ? [[index, cell.initialValue]] : [],
    ),
  );
}

export function getInitialPuzzleWord(puzzle: PuzzleDefinition): PuzzleWord {
  const word = puzzle.words.find(({ id }) => id === puzzle.initialSelection.wordId);

  if (!word) {
    throw new Error(
      `Puzzle "${puzzle.id}" is missing initial word "${puzzle.initialSelection.wordId}".`,
    );
  }

  return word;
}
