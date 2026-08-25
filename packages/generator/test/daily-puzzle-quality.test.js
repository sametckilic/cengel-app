const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const { createDailyPuzzleRecipe } = require('../src/daily-puzzle-recipe');
const {
  buildDailyPuzzleCandidate,
  resolveQualityPolicy,
} = require('../src/daily-puzzle-quality');

const recipe = createDailyPuzzleRecipe({
  date: '2026-08-23',
  profile: {
    title: 'Günün Bulmacası',
    topologyId: 'newspaper-9x10-v1',
    difficulty: 'easy',
    categories: ['turkce', 'genel_kultur'],
    categoryWeight: 0.6,
  },
  revision: 'v1',
});

test('accepts a dense and balanced daily newspaper candidate', () => {
  const { puzzle, quality } = buildDailyPuzzleCandidate(catalog.entries, recipe);

  assert.equal(quality.passed, true);
  assert.deepEqual(quality.issues, []);
  assert.deepEqual(
    { ...quality.metrics, themedWordCount: undefined },
    {
    answerLengthAverage: 3.8,
    directionShare: 0.44,
    fallbackWordCount: 5,
    fallbackWordShare: 0.2,
    intersectionCount: 25,
    intersectionRatio: 1,
    occupiedRatio: 1,
    requiredThemedWordCount: 15,
    themedWordCount: undefined,
    wordCount: 25,
    },
  );
  assert.ok(
    quality.metrics.themedWordCount >= quality.metrics.requiredThemedWordCount,
  );
  assert.equal(puzzle.id, 'gunun-2026-08-23');
});

test('rejects a candidate that misses a configured quality threshold', () => {
  assert.throws(
    () =>
      buildDailyPuzzleCandidate(catalog.entries, recipe, {
        maximumFallbackWordShare: 0.1,
      }),
    /Fallback word share 0.2 exceeds 0.1/,
  );
});

test('rejects invalid quality policies before publication', () => {
  assert.throws(
    () => resolveQualityPolicy({ minimumDirectionShare: 0.6 }),
    /cannot be greater than 0.5/,
  );
  assert.throws(
    () => resolveQualityPolicy({ minimumIntersectionRatio: -1 }),
    /non-negative number/,
  );
});

test('applies the daily quality gate to a readable V2 candidate', () => {
  const v2Recipe = createDailyPuzzleRecipe({
    date: '2026-09-01',
    profile: {
      title: 'Günün Bulmacası',
      generatorVersion: 'newspaper-v2',
      rowCount: 10,
      columnCount: 10,
      targetWordCount: 29,
      difficulty: 'easy',
      categories: ['tarih', 'cografya', 'genel_kultur', 'turkce'],
      categoryWeight: 0.55,
    },
    revision: 'schedule-v2',
  });
  const { diagnostics, puzzle, quality } = buildDailyPuzzleCandidate(
    catalog.entries,
    v2Recipe,
  );

  assert.equal(quality.passed, true);
  assert.equal(puzzle.generation.generatorVersion, 'newspaper-v2');
  assert.equal(diagnostics.aesthetic.passed, true);
  assert.equal(quality.policy.maximumFallbackWordShare, 0.36);
  assert.equal(quality.policy.minimumAnswerLengthAverage, 3.4);
  assert.ok(diagnostics.clueText.maximumSingleUnits <= 24);
  assert.ok(diagnostics.clueText.maximumSplitUnits <= 18);
});
