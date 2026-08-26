export type GameplayDifficulty = 'beginner' | 'easy' | 'hard' | 'medium';

export type ClueCatalogEntry = {
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
  entries: readonly ClueCatalogEntry[];
  filters: {
    ambiguityScoreMax: number | null;
    answerLengthMax: number | null;
    answerLengthMin: number | null;
    clarityScoreMin: number | null;
    clueQualityMin: number | null;
    factualityScoreMin: number | null;
    gameplayScoreMin: number | null;
    gameplayStatus: 'ready';
  };
  rights: {
    basis: 'project-owned';
    confirmedAt: '2026-08-19';
  };
  schemaVersion: 1;
  sourceFile: string;
  usage: 'project-owned';
};
