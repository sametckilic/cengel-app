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
    ambiguityScoreMax: number;
    answerLengthMax: number;
    answerLengthMin: number;
    clarityScoreMin: number;
    clueQualityMin: number;
    factualityScoreMin: number;
    gameplayScoreMin: number;
  };
  rights: {
    basis: 'project-owned';
    confirmedAt: '2026-08-19';
  };
  schemaVersion: 1;
  sourceFile: string;
  usage: 'project-owned';
};
