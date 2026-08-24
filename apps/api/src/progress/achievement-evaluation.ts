import {
  createPuzzleCompletionEvidence,
  evaluateAchievements,
  type EarnedAchievement,
  type PuzzleValidationMode,
} from '@cengel/achievement-core';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAchievementProgress(
  value: unknown,
): value is {
  puzzleId: string;
  revealedWordIds: readonly string[];
  solvedWordIds: readonly string[];
  updatedAt: string;
} {
  return (
    isRecord(value) &&
    typeof value.puzzleId === 'string' &&
    isStringArray(value.revealedWordIds) &&
    isStringArray(value.solvedWordIds) &&
    typeof value.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.updatedAt))
  );
}

function isAchievementPuzzle(
  value: unknown,
): value is { id: string; words: readonly { id: string }[] } {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.words) &&
    value.words.length > 0 &&
    value.words.every((word) => isRecord(word) && typeof word.id === 'string')
  );
}

export type AchievementProgressRecord = {
  deleted: boolean;
  puzzleId: string;
  snapshot: unknown;
};

export type AchievementPuzzleRecord = {
  definition: unknown;
  id: string;
  validationMode: PuzzleValidationMode;
  version: number;
};

export function evaluateProgressAchievements(
  progressRecords: readonly AchievementProgressRecord[],
  puzzleRecords: readonly AchievementPuzzleRecord[],
): readonly EarnedAchievement[] {
  const latestPuzzleById = new Map<string, AchievementPuzzleRecord>();

  for (const record of puzzleRecords) {
    const current = latestPuzzleById.get(record.id);

    if (!current || record.version > current.version) {
      latestPuzzleById.set(record.id, record);
    }
  }

  const completions = progressRecords.flatMap((progress) => {
    if (progress.deleted || !isAchievementProgress(progress.snapshot)) {
      return [];
    }

    const puzzleRecord = latestPuzzleById.get(progress.puzzleId);

    if (
      !puzzleRecord ||
      !isAchievementPuzzle(puzzleRecord.definition) ||
      puzzleRecord.definition.id !== progress.puzzleId
    ) {
      return [];
    }

    const evidence = createPuzzleCompletionEvidence(
      puzzleRecord.definition,
      progress.snapshot,
      puzzleRecord.validationMode,
    );

    return evidence ? [evidence] : [];
  });

  return evaluateAchievements(completions);
}
