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
const largeV2Profile = {
  title: 'Günün Bulmacası',
  generatorVersion: 'newspaper-v2',
  rowCount: 10,
  columnCount: 10,
  targetWordCount: 32,
  difficulty: 'easy',
  categories: ['tarih', 'cografya', 'genel_kultur', 'turkce'],
  categoryWeight: 0.55,
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

test('creates and builds a V2 daily recipe without a fixed topology id', () => {
  const recipe = createDailyPuzzleRecipe({
    date: '2026-09-01',
    profile: largeV2Profile,
    revision: 'schedule-v2',
  });

  assert.equal(recipe.generatorVersion, 'newspaper-v2');
  assert.equal(recipe.topologyId, undefined);
  assert.equal(recipe.rowCount, 10);
  assert.equal(recipe.columnCount, 10);
  assert.equal(recipe.targetWordCount, 32);
  assert.match(recipe.seed, /newspaper-v2-10x10-32/);

  const manifest = buildPuzzleManifest(catalog, {
    schemaVersion: 1,
    recipes: [recipe],
  });
  const puzzle = manifest.puzzles[0];

  assert.equal(puzzle.generation.generatorVersion, 'newspaper-v2');
  assert.match(
    puzzle.generation.topologyId,
    /^newspaper-canonical-10x10-/,
  );
  assert.equal(typeof puzzle.generation.topologyFingerprint, 'string');
  assert.equal(puzzle.cells.some(({ type }) => type === 'void'), false);
  assert.equal(puzzle.words.length, 32);
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
