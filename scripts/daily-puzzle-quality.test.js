const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../data/generated/clue-catalog.json');
const { createDailyPuzzleRecipe } = require('./lib/daily-puzzle-recipe');
const {
  buildDailyPuzzleCandidate,
  resolveQualityPolicy,
} = require('./lib/daily-puzzle-quality');

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
  assert.deepEqual(quality.metrics, {
    answerLengthAverage: 3.8,
    directionShare: 0.44,
    fallbackWordCount: 5,
    fallbackWordShare: 0.2,
    intersectionCount: 25,
    intersectionRatio: 1,
    occupiedRatio: 1,
    requiredThemedWordCount: 15,
    themedWordCount: 20,
    wordCount: 25,
  });
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
