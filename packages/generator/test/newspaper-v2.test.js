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
  targetWordCount: 29,
};
const options = {
  maximumFillAttempts: 4,
  maximumSuccessfulFills: 1,
  maxSearchNodesPerTopology: 5_000,
  topology: {
    maxCandidates: 4,
    maxPatternAttempts: 20_000,
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
  assert.equal(first.diagnostics.canonical.passed, true);
  assert.ok(
    ['right', 'down'].includes(first.diagnostics.themePrimaryDirection),
  );
  assert.equal(
    first.diagnostics.topologyGeneration.generationMode,
    'outside-in-canonical',
  );
  assert.ok(first.diagnostics.clueText.maximumSingleUnits <= 24);
  assert.ok(first.diagnostics.clueText.maximumSplitUnits <= 23);
  assert.ok(
    first.diagnostics.themedWordCount >= first.diagnostics.requiredThemedWordCount,
  );
  assert.doesNotThrow(() => validateNewspaperPuzzle(first.puzzle));
});

test('fills a compact canonical topology with a category majority', () => {
  const retryRequest = {
    id: 'newspaper-v2-retry-test-7x7',
    title: 'V2 7Ã—7 Retry Test BulmacasÄ±',
    categories: ['cografya', 'yer', 'turkce'],
    categoryWeight: 0.6,
    columnCount: 7,
    difficulty: 'beginner',
    rowCount: 7,
    seed: 'newspaper-v2-preview-7x7-a',
    targetWordCount: 18,
  };
  const result = generateNewspaperPuzzleV2(
    catalog.entries,
    retryRequest,
    {
      ...options,
      maximumFillAttempts: 4,
      maximumSuccessfulFills: 1,
      maxSearchNodesPerTopology: 5_000,
      topology: {
        maxCandidates: 4,
        maxPatternAttempts: 20_000,
      },
    },
  );

  assert.equal(result.diagnostics.successfulFillCount, 1);
  assert.ok(
    result.diagnostics.themedWordCount >=
      result.diagnostics.requiredThemedWordCount,
  );
  assert.equal(
    result.diagnostics.topologyGeneration.generationMode,
    'outside-in-canonical',
  );
});
