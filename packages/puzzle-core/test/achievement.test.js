const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPuzzleCompletionEvidence,
  evaluateAchievements,
} = require('../../achievement-core/src/achievement.js');

function completion(puzzleId, completedAt, overrides = {}) {
  return {
    completedAt,
    puzzleId,
    usedHint: false,
    validationMode: 'offline-casual',
    ...overrides,
  };
}

test('creates completion evidence only after every puzzle word is solved', () => {
  const puzzle = { id: 'puzzle-1', words: [{ id: 'word-1' }, { id: 'word-2' }] };
  const progress = {
    entries: {},
    puzzleId: puzzle.id,
    revealedWordIds: ['word-2'],
    schemaVersion: 1,
    selection: { cellIndex: 1, wordId: 'word-1' },
    solvedWordIds: ['word-1'],
    updatedAt: '2026-08-20T10:00:00.000Z',
  };

  assert.equal(createPuzzleCompletionEvidence(puzzle, progress), null);
  assert.deepEqual(
    createPuzzleCompletionEvidence(puzzle, {
      ...progress,
      solvedWordIds: ['word-1', 'word-2'],
    }),
    {
      completedAt: progress.updatedAt,
      puzzleId: puzzle.id,
      usedHint: true,
      validationMode: 'offline-casual',
    },
  );
});

test('awards first completion and the first hint-free completion independently', () => {
  const achievements = evaluateAchievements([
    completion('puzzle-with-hint', '2026-08-20T10:00:00.000Z', { usedHint: true }),
    completion('puzzle-without-hint', '2026-08-21T10:00:00.000Z'),
  ]);

  assert.deepEqual(achievements.slice(0, 2), [
    {
      achievementId: 'first-completion',
      earnedAt: '2026-08-20T10:00:00.000Z',
      evidencePuzzleIds: ['puzzle-with-hint'],
      verification: 'casual',
    },
    {
      achievementId: 'no-hint-completion',
      earnedAt: '2026-08-21T10:00:00.000Z',
      evidencePuzzleIds: ['puzzle-without-hint'],
      verification: 'casual',
    },
  ]);
});

test('awards daily streaks by puzzle publication dates regardless of sync order', () => {
  const completions = Array.from({ length: 7 }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return completion(
      `gunun-2026-08-${day}`,
      `2026-08-${day}T18:00:00.000Z`,
      { validationMode: 'server-verified' },
    );
  }).reverse();
  const achievements = evaluateAchievements(completions);

  assert.deepEqual(
    achievements.filter(({ achievementId }) => achievementId.startsWith('daily-streak')),
    [
      {
        achievementId: 'daily-streak-3',
        earnedAt: '2026-08-03T18:00:00.000Z',
        evidencePuzzleIds: [
          'gunun-2026-08-01',
          'gunun-2026-08-02',
          'gunun-2026-08-03',
        ],
        verification: 'verified',
      },
      {
        achievementId: 'daily-streak-7',
        earnedAt: '2026-08-07T18:00:00.000Z',
        evidencePuzzleIds: [
          'gunun-2026-08-01',
          'gunun-2026-08-02',
          'gunun-2026-08-03',
          'gunun-2026-08-04',
          'gunun-2026-08-05',
          'gunun-2026-08-06',
          'gunun-2026-08-07',
        ],
        verification: 'verified',
      },
    ],
  );
});

test('does not count archive puzzles or dates separated by a gap toward a streak', () => {
  const achievements = evaluateAchievements([
    completion('gunun-2026-08-01', '2026-08-01T18:00:00.000Z'),
    completion('archive-2026-08-02', '2026-08-02T18:00:00.000Z'),
    completion('gunun-2026-08-03', '2026-08-03T18:00:00.000Z'),
    completion('gunun-2026-08-04', '2026-08-04T18:00:00.000Z'),
  ]);

  assert.equal(
    achievements.some(({ achievementId }) => achievementId === 'daily-streak-3'),
    false,
  );
});

test('marks a streak casual when any contributing completion is offline-casual', () => {
  const achievements = evaluateAchievements([
    completion('gunun-2026-08-01', '2026-08-01T18:00:00.000Z', {
      validationMode: 'server-verified',
    }),
    completion('gunun-2026-08-02', '2026-08-02T18:00:00.000Z'),
    completion('gunun-2026-08-03', '2026-08-03T18:00:00.000Z', {
      validationMode: 'server-verified',
    }),
  ]);

  assert.equal(
    achievements.find(({ achievementId }) => achievementId === 'daily-streak-3')?.verification,
    'casual',
  );
});
