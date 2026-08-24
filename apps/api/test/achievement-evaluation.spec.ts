import { describe, expect, it } from 'vitest';

import {
  evaluateProgressAchievements,
  type AchievementProgressRecord,
  type AchievementPuzzleRecord,
} from '../src/progress/achievement-evaluation';

function puzzleRecord(
  puzzleId: string,
  overrides: Partial<AchievementPuzzleRecord> = {},
): AchievementPuzzleRecord {
  return {
    definition: {
      categories: ['genel_kultur'],
      cells: [{ type: 'letter' }],
      columnCount: 1,
      difficulty: 'easy',
      id: puzzleId,
      initialSelection: { cellIndex: 0, wordId: `${puzzleId}-word` },
      rowCount: 1,
      title: puzzleId,
      words: [{ id: `${puzzleId}-word` }],
    },
    id: puzzleId,
    validationMode: 'offline-casual',
    version: 1,
    ...overrides,
  };
}

function completedProgress(
  puzzleId: string,
  completedAt: string,
  overrides: Partial<AchievementProgressRecord> = {},
): AchievementProgressRecord {
  return {
    deleted: false,
    puzzleId,
    snapshot: {
      entries: { 0: 'A' },
      puzzleId,
      revealedWordIds: [],
      schemaVersion: 1,
      selection: { cellIndex: 0, wordId: `${puzzleId}-word` },
      solvedWordIds: [`${puzzleId}-word`],
      updatedAt: completedAt,
    },
    ...overrides,
  };
}

describe('progress achievement evaluation', () => {
  it('evaluates canonical completed progress against published puzzle records', () => {
    const puzzleIds = ['gunun-2026-08-01', 'gunun-2026-08-02', 'gunun-2026-08-03'];
    const progress = puzzleIds.map((puzzleId, index) =>
      completedProgress(puzzleId, `2026-08-0${index + 1}T18:00:00.000Z`),
    );
    const achievements = evaluateProgressAchievements(
      progress,
      puzzleIds.map((puzzleId) => puzzleRecord(puzzleId)),
    );

    expect(achievements.map(({ achievementId }) => achievementId)).toEqual([
      'first-completion',
      'no-hint-completion',
      'daily-streak-3',
    ]);
  });

  it('ignores deleted, incomplete, malformed, and unknown puzzle progress', () => {
    const validPuzzle = puzzleRecord('known-puzzle');
    const achievements = evaluateProgressAchievements(
      [
        completedProgress('known-puzzle', '2026-08-01T18:00:00.000Z', {
          deleted: true,
        }),
        completedProgress('known-puzzle', '2026-08-01T18:00:00.000Z', {
          snapshot: { malformed: true },
        }),
        completedProgress('unknown-puzzle', '2026-08-01T18:00:00.000Z'),
      ],
      [validPuzzle],
    );

    expect(achievements).toEqual([]);
  });

  it('uses the latest published puzzle version for completion validation', () => {
    const puzzleId = 'versioned-puzzle';
    const oldPuzzle = puzzleRecord(puzzleId);
    const latestPuzzle = puzzleRecord(puzzleId, {
      definition: {
        ...(oldPuzzle.definition as Record<string, unknown>),
        words: [{ id: 'different-word' }],
      },
      version: 2,
    });
    const achievements = evaluateProgressAchievements(
      [completedProgress(puzzleId, '2026-08-01T18:00:00.000Z')],
      [oldPuzzle, latestPuzzle],
    );

    expect(achievements).toEqual([]);
  });
});
