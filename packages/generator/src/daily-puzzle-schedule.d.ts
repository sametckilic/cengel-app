export type GeneratorClueEntry = {
  answer: string;
  answerLength: number;
  category: string;
  clue: string;
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard';
  fallbackOnly: boolean;
  id: string;
  kind: string;
  shortClue: string;
};

export type GeneratorClueCatalog = {
  entries: GeneratorClueEntry[];
  rights: {
    basis: 'project-owned';
    confirmedAt: string;
  };
  schemaVersion: 1;
  sourceFile: string;
  usage: 'project-owned';
};

export type DailyPuzzlePublication = {
  date: string;
  profileId: string;
  puzzle: {
    categories: string[];
    columnCount: number;
    difficulty: 'beginner' | 'easy' | 'medium' | 'hard';
    id: string;
    rowCount: number;
    title: string;
    words: unknown[];
    [key: string]: unknown;
  };
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

export function addDaysToIsoDate(date: string, dayOffset: number): string;

export function createScheduledDailyPublication(
  catalog: GeneratorClueCatalog,
  request: { date: string; revision: string },
  options?: {
    generatorVersion?: 'newspaper-v1' | 'newspaper-v2';
  },
): DailyPuzzlePublication;

export function getDateKeyInTimeZone(
  date?: Date,
  timeZone?: string,
): string;
