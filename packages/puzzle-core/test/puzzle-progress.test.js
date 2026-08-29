const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPuzzleProgressSnapshot,
  createMemoryPuzzleProgressStore,
  getPuzzleProgressSummary,
  isPuzzleProgressSnapshot,
  parsePuzzleProgress,
  restorePuzzleProgress,
  serializePuzzleProgress,
} = require('../src/puzzle-progress.ts');
const {
  beginPuzzleWordEntry,
  enterPuzzleLetter,
} = require('../src/puzzle-input.ts');
const {
  getLockedCellIndices,
  isPuzzleComplete,
  validateSelectedWord,
} = require('../src/puzzle-validation.ts');
const [puzzle] = require('../../../apps/mobile/data/generated/newspaper-v2-preview.json').puzzles;

function createProgress(overrides = {}) {
  return {
    entries: { 1: 'İ', 2: 'S' },
    puzzleId: 'daily-2026-08-20',
    revealedWordIds: [],
    schemaVersion: 1,
    selection: { cellIndex: 2, wordId: 'word-1' },
    solvedWordIds: ['word-1'],
    updatedAt: '2026-08-20T18:00:00.000Z',
    ...overrides,
  };
}

test('round-trips a valid puzzle progress snapshot', () => {
  const progress = createProgress();

  assert.equal(isPuzzleProgressSnapshot(progress), true);
  assert.deepEqual(parsePuzzleProgress(serializePuzzleProgress(progress)), progress);
});

test('rejects malformed, stale, and invalid Turkish entry payloads', () => {
  assert.equal(parsePuzzleProgress('{broken'), null);
  assert.equal(
    isPuzzleProgressSnapshot(createProgress({ schemaVersion: 2 })),
    false,
  );
  assert.equal(
    isPuzzleProgressSnapshot(createProgress({ entries: { 1: 'i' } })),
    false,
  );
  assert.throws(
    () => serializePuzzleProgress(createProgress({ updatedAt: 'not-a-date' })),
    /invalid puzzle progress/,
  );
});

test('memory store saves, lists, replaces, and removes progress by puzzle id', async () => {
  const store = createMemoryPuzzleProgressStore();
  const first = createProgress();
  const second = createProgress({
    entries: { 8: 'A' },
    puzzleId: 'archive-1',
    solvedWordIds: [],
    updatedAt: '2026-08-20T19:00:00.000Z',
  });

  await store.save(first);
  await store.save(second);
  assert.deepEqual(await store.list(), [second, first]);

  const replacement = createProgress({ entries: { 1: 'A' } });
  await store.save(replacement);
  assert.deepEqual(await store.load(first.puzzleId), replacement);

  await store.remove(first.puzzleId);
  assert.equal(await store.load(first.puzzleId), null);
});

test('creates and restores progress that still matches the current puzzle definition', () => {
  const word = puzzle.words[0];
  const entries = Object.fromEntries(
    word.cellIndices.map((cellIndex, letterIndex) => [cellIndex, word.answer[letterIndex]]),
  );
  const snapshot = createPuzzleProgressSnapshot(
    puzzle.id,
    {
      entries,
      revealedWordIds: new Set(),
      selection: { cellIndex: word.cellIndices[1], wordId: word.id },
      solvedWordIds: new Set([word.id]),
    },
    '2026-08-20T20:00:00.000Z',
  );
  const restored = restorePuzzleProgress(puzzle, snapshot);

  assert.deepEqual(restored?.entries, entries);
  assert.deepEqual(restored?.selection, snapshot.selection);
  assert.deepEqual(restored?.solvedWordIds, new Set([word.id]));
});

test('rejects progress whose selection or solved answer no longer matches the puzzle', () => {
  const word = puzzle.words[0];
  const snapshot = createProgress({
    entries: { [word.cellIndices[0]]: 'A' },
    puzzleId: puzzle.id,
    selection: { cellIndex: 0, wordId: word.id },
    solvedWordIds: [word.id],
  });

  assert.equal(restorePuzzleProgress(puzzle, snapshot), null);
});

test('summarizes not-started, in-progress, and completed puzzle progress', () => {
  const firstWord = puzzle.words[0];
  const notStarted = getPuzzleProgressSummary(puzzle, null);
  const inProgress = getPuzzleProgressSummary(
    puzzle,
    createProgress({
      puzzleId: puzzle.id,
      solvedWordIds: [firstWord.id],
      revealedWordIds: [firstWord.id],
    }),
  );
  const completed = getPuzzleProgressSummary(
    puzzle,
    createProgress({
      puzzleId: puzzle.id,
      solvedWordIds: puzzle.words.map(({ id }) => id),
      revealedWordIds: [],
    }),
  );

  assert.deepEqual(notStarted, {
    completionPercentage: 0,
    revealedWordCount: 0,
    solvedWordCount: 0,
    status: 'not-started',
    totalWordCount: puzzle.words.length,
  });
  assert.equal(inProgress.status, 'in-progress');
  assert.equal(inProgress.solvedWordCount, 1);
  assert.equal(inProgress.revealedWordCount, 1);
  assert.equal(completed.status, 'completed');
  assert.equal(completed.completionPercentage, 100);
});

test('solves, saves, restores, and summarizes the complete newspaper puzzle flow', async () => {
  let state = {
    entries: {},
    selection: { ...puzzle.initialSelection },
  };
  const solvedWordIds = new Set();

  for (const word of puzzle.words) {
    const lockedCellIndices = getLockedCellIndices(puzzle, solvedWordIds);
    state = beginPuzzleWordEntry(
      puzzle,
      {
        ...state,
        selection: { cellIndex: word.cellIndices[0], wordId: word.id },
      },
      lockedCellIndices,
    );

    for (const cellIndex of word.cellIndices) {
      if (lockedCellIndices.has(cellIndex)) {
        continue;
      }

      const letterIndex = word.cellIndices.indexOf(cellIndex);
      state = enterPuzzleLetter(
        puzzle,
        state,
        word.answer[letterIndex],
        lockedCellIndices,
      );
    }

    assert.deepEqual(validateSelectedWord(puzzle, state.entries, state.selection), {
      status: 'correct',
      wordId: word.id,
    });
    solvedWordIds.add(word.id);
  }

  assert.equal(isPuzzleComplete(puzzle, solvedWordIds), true);

  const store = createMemoryPuzzleProgressStore();
  const snapshot = createPuzzleProgressSnapshot(
    puzzle.id,
    {
      entries: state.entries,
      revealedWordIds: new Set(),
      selection: state.selection,
      solvedWordIds,
    },
    '2026-08-22T12:00:00.000Z',
  );

  await store.save(snapshot);
  const loaded = await store.load(puzzle.id);
  const restored = loaded ? restorePuzzleProgress(puzzle, loaded) : null;
  const summary = getPuzzleProgressSummary(puzzle, loaded);

  assert.ok(restored);
  assert.deepEqual(restored.solvedWordIds, solvedWordIds);
  assert.deepEqual(restored.entries, state.entries);
  assert.equal(summary.status, 'completed');
  assert.equal(summary.completionPercentage, 100);
  assert.equal(summary.solvedWordCount, puzzle.words.length);
});
