export const ACHIEVEMENT_DEFINITIONS: readonly AchievementDefinition[];

export type AchievementDefinition = {
  description: string;
  id: AchievementId;
  target: number;
  title: string;
  type: 'completion' | 'daily-streak' | 'no-hint-completion';
};

export type AchievementId =
  | 'daily-streak-3'
  | 'daily-streak-7'
  | 'first-completion'
  | 'no-hint-completion';
export type AchievementVerification = 'casual' | 'verified';
export type PuzzleValidationMode = 'offline-casual' | 'server-verified';

export type PuzzleCompletionEvidence = {
  completedAt: string;
  puzzleId: string;
  usedHint: boolean;
  validationMode: PuzzleValidationMode;
};

export type EarnedAchievement = {
  achievementId: AchievementId;
  earnedAt: string;
  evidencePuzzleIds: readonly string[];
  verification: AchievementVerification;
};

export type AchievementPuzzle = {
  id: string;
  words: readonly { id: string }[];
};

export type AchievementProgress = {
  puzzleId: string;
  revealedWordIds: readonly string[];
  solvedWordIds: readonly string[];
  updatedAt: string;
};

export function createPuzzleCompletionEvidence(
  puzzle: AchievementPuzzle,
  progress: AchievementProgress,
  validationMode?: PuzzleValidationMode,
): PuzzleCompletionEvidence | null;

export function evaluateAchievements(
  completionEvidence: readonly PuzzleCompletionEvidence[],
): readonly EarnedAchievement[];
