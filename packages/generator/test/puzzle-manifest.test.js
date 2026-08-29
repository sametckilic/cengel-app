const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const [previewPuzzle] = require('../../../apps/mobile/data/generated/newspaper-v2-preview.json').puzzles;
const recipes = require('../../../apps/mobile/data/puzzle-recipes.json');
const {
  buildPuzzleManifest,
  validateDailyPublication,
  validateGeneratedPuzzle,
} = require('../src/puzzle-manifest');

const publicationDate = '2099-12-31';
const dailyPuzzle = {
  ...previewPuzzle,
  id: `gunun-${publicationDate}`,
  title: 'Günün Bulmacası',
};
const dailyPublication = {
  date: publicationDate,
  generationDiagnostics: {},
  profileId: 'test-v2-profile',
  puzzle: dailyPuzzle,
  quality: { issues: [], passed: true },
  recipe: {
    categories: dailyPuzzle.categories,
    categoryWeight: dailyPuzzle.generation.categoryWeight,
    columnCount: dailyPuzzle.columnCount,
    difficulty: dailyPuzzle.difficulty,
    format: 'newspaper-arrowword',
    generatorVersion: 'newspaper-v2',
    id: dailyPuzzle.id,
    rowCount: dailyPuzzle.rowCount,
    seed: dailyPuzzle.generation.seed,
    targetWordCount: dailyPuzzle.words.length,
    title: dailyPuzzle.title,
  },
  revision: 'test-v2',
  rights: catalog.rights,
  schemaVersion: 1,
  sourceCatalog: 'data/generated/clue-catalog.json',
};

test('keeps the bundled manifest free of retired static recipes', () => {
  const manifest = buildPuzzleManifest(catalog, recipes);

  assert.equal(manifest.schemaVersion, 1);
  assert.deepEqual(recipes.recipes, []);
  assert.deepEqual(manifest.puzzles, []);
});

test('merges quality-approved daily publications into the shared manifest', () => {
  const manifest = buildPuzzleManifest(catalog, recipes, [dailyPublication]);
  const dailyPuzzle = manifest.puzzles.find(
    ({ id }) => id === dailyPublication.puzzle.id,
  );

  assert.equal(manifest.puzzles.length, recipes.recipes.length + 1);
  assert.deepEqual(dailyPuzzle, dailyPublication.puzzle);
  assert.equal(validateDailyPublication(catalog, dailyPublication), dailyPublication.puzzle);
});

test('rejects invalid or duplicate daily publications', () => {
  assert.throws(
    () =>
      buildPuzzleManifest(catalog, recipes, [
        { ...dailyPublication, quality: { ...dailyPublication.quality, passed: false } },
      ]),
    /invalid publication contract/,
  );
  assert.throws(
    () => buildPuzzleManifest(catalog, recipes, [dailyPublication, dailyPublication]),
    /unique/,
  );
});
