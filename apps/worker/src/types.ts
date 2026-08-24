export type GameplayDifficulty = 'beginner' | 'easy' | 'medium' | 'hard';

export type ClueEntry = {
  answer: string;
  answerLength: number;
  category: string;
  clue: string;
  difficulty: GameplayDifficulty;
  fallbackOnly: boolean;
  id: string;
  kind: string;
  shortClue: string;
};

export type ClueCatalog = {
  entries: ClueEntry[];
  rights: {
    basis: 'project-owned';
    confirmedAt: string;
  };
  schemaVersion: 1;
  sourceFile: string;
  usage: 'project-owned';
};

export type PuzzleDefinition = {
  categories: string[];
  columnCount: number;
  difficulty: GameplayDifficulty;
  id: string;
  rowCount: number;
  title: string;
  words: unknown[];
  [key: string]: unknown;
};

export type DailyPublication = {
  date: string;
  profileId: string;
  puzzle: PuzzleDefinition;
  quality: {
    issues: string[];
    passed: boolean;
    [key: string]: unknown;
  };
  recipe: {
    seed: string;
    [key: string]: unknown;
  };
  revision: string;
  schemaVersion: 1;
  [key: string]: unknown;
};

export type CatalogSnapshot = {
  catalog: ClueCatalog;
  catalogVersionId: string;
  checksum: string;
};
