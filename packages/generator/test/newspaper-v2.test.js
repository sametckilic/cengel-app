const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const { validateNewspaperPuzzle } = require('../src/newspaper-grid');
const { generateNewspaperPuzzleV2 } = require('../src/newspaper-v2');

const request = {
  id: 'newspaper-v2-test-9x10',
  title: 'V2 9×10 Test Bulmacası',
  categories: ['turkce', 'genel_kultur'],
  categoryWeight: 0.6,
  columnCount: 10,
  difficulty: 'easy',
  rowCount: 9,
  seed: 'newspaper-v2-test-a',
  targetWordCount: 25,
};
const options = {
  maximumFillAttempts: 4,
  maximumSuccessfulFills: 1,
  maxSearchNodesPerTopology: 5_000,
  topology: {
    beamWidth: 200,
    maxCandidates: 4,
    maxMutationDepth: 1,
  },
};

test('selects a deterministic, readable and aesthetic filled topology', () => {
  const first = generateNewspaperPuzzleV2(catalog.entries, request, options);
  const second = generateNewspaperPuzzleV2(catalog.entries, request, options);

  assert.deepEqual(first, second);
  assert.equal(first.puzzle.generation.generatorVersion, 'newspaper-v2');
  assert.equal(first.puzzle.words.length, request.targetWordCount);
  assert.equal(first.puzzle.cells.length, request.rowCount * request.columnCount);
  assert.ok(first.puzzle.cells.every(({ type }) => type !== 'void'));
  assert.ok(first.puzzle.words.some(({ clueArrow }) => clueArrow === 'right-down'));
  assert.ok(first.puzzle.words.some(({ clueArrow }) => clueArrow === 'down-right'));
  assert.equal(first.diagnostics.aesthetic.passed, true);
  assert.ok(first.diagnostics.clueText.maximumSingleUnits <= 24);
  assert.ok(first.diagnostics.clueText.maximumSplitUnits <= 18);
  assert.ok(
    first.diagnostics.themedWordCount >= first.diagnostics.requiredThemedWordCount,
  );
  assert.doesNotThrow(() => validateNewspaperPuzzle(first.puzzle));
});

test('continues with another topology when a fill attempt reaches its node limit', () => {
  const retryRequest = {
    ...request,
    id: 'newspaper-v2-retry-test-9x10',
    categories: ['bilim', 'teknoloji', 'genel_kultur'],
    difficulty: 'beginner',
    seed:
      'gunun-2026-09-05:matrix-v1-a1:newspaper-v2-9x10-25:' +
      'beginner:bilim+teknoloji+genel_kultur:0.6',
  };
  const result = generateNewspaperPuzzleV2(
    catalog.entries,
    retryRequest,
    {
      ...options,
      maximumFillAttempts: 8,
      maximumSuccessfulFills: 1,
      maxSearchNodesPerTopology: 5_000,
      topology: {
        beamWidth: 200,
        maxCandidates: 8,
        maxMutationDepth: 1,
      },
    },
  );

  assert.ok(result.diagnostics.failedFills.length >= 1);
  assert.equal(result.diagnostics.successfulFillCount, 1);
  assert.ok(result.diagnostics.fillAttemptCount > 1);
});
