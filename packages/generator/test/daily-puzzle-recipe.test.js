const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const { createDailyPuzzleRecipe, validateIsoDate } = require('../src/daily-puzzle-recipe');
const { buildPuzzleManifest } = require('../src/puzzle-manifest');

const easyProfile = {
  title: 'Günün Bulmacası',
  topologyId: 'newspaper-9x10-v1',
  difficulty: 'easy',
  categories: ['turkce', 'genel_kultur'],
  categoryWeight: 0.6,
};

test('creates an explicit deterministic daily newspaper recipe', () => {
  const input = {
    date: '2026-08-23',
    profile: easyProfile,
    revision: 'v1',
  };
  const firstRecipe = createDailyPuzzleRecipe(input);
  const secondRecipe = createDailyPuzzleRecipe(input);

  assert.deepEqual(firstRecipe, secondRecipe);
  assert.deepEqual(firstRecipe, {
    id: 'gunun-2026-08-23',
    title: 'Günün Bulmacası',
    format: 'newspaper-arrowword',
    topologyId: 'newspaper-9x10-v1',
    rowCount: 9,
    columnCount: 10,
    difficulty: 'easy',
    categories: ['turkce', 'genel_kultur'],
    categoryWeight: 0.6,
    seed:
      'gunun-2026-08-23:v1:newspaper-9x10-v1:easy:turkce+genel_kultur:0.6',
    targetWordCount: 25,
  });
});

test('builds the generated daily recipe into a valid fixed puzzle', () => {
  const recipe = createDailyPuzzleRecipe({
    date: '2026-08-23',
    profile: easyProfile,
    revision: 'v1',
  });
  const manifest = buildPuzzleManifest(catalog, {
    schemaVersion: 1,
    recipes: [recipe],
  });
  const puzzle = manifest.puzzles[0];

  assert.equal(puzzle.id, recipe.id);
  assert.equal(puzzle.generation.seed, recipe.seed);
  assert.equal(puzzle.format, 'newspaper-arrowword');
  assert.equal(puzzle.cells.filter(({ type }) => type === 'void').length, 0);
  assert.equal(puzzle.words.length, 25);
});

test('changes the seed when generation configuration changes', () => {
  const firstRecipe = createDailyPuzzleRecipe({
    date: '2026-08-23',
    profile: easyProfile,
    revision: 'v1',
  });
  const nextRecipe = createDailyPuzzleRecipe({
    date: '2026-08-23',
    profile: easyProfile,
    revision: 'v2',
  });

  assert.equal(firstRecipe.id, nextRecipe.id);
  assert.notEqual(firstRecipe.seed, nextRecipe.seed);
});

test('rejects malformed and impossible daily dates', () => {
  assert.equal(validateIsoDate('2028-02-29'), '2028-02-29');
  assert.throws(() => validateIsoDate('23-08-2026'), /YYYY-MM-DD/);
  assert.throws(() => validateIsoDate('2026-02-29'), /valid calendar date/);
});
