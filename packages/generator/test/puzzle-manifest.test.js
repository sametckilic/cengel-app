const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const dailyPublication = require('../../../apps/mobile/data/generated/daily/gunun-2026-08-23.json');
const recipes = require('../../../apps/mobile/data/puzzle-recipes.json');
const {
  buildPuzzleManifest,
  validateDailyPublication,
  validateGeneratedPuzzle,
} = require('../src/puzzle-manifest');

test('builds every configured puzzle recipe into a valid definition', () => {
  const manifest = buildPuzzleManifest(catalog, recipes);

  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.puzzles.length, recipes.recipes.length);
  assert.equal(new Set(manifest.puzzles.map(({ id }) => id)).size, manifest.puzzles.length);

  for (const puzzle of manifest.puzzles) {
    const recipe = recipes.recipes.find(({ id }) => id === puzzle.id);

    assert.ok(recipe);
    assert.equal(puzzle.rowCount, recipe.rowCount);
    assert.equal(puzzle.columnCount, recipe.columnCount);
    assert.equal(puzzle.difficulty, recipe.difficulty);
    assert.deepEqual(puzzle.categories, recipe.categories);
    assert.equal(puzzle.words.length, recipe.targetWordCount);
    assert.ok(puzzle.cells.every(({ type }) => type !== 'block'));
    assert.ok(
      puzzle.words.filter(({ category }) => recipe.categories.includes(category)).length >=
        Math.ceil(recipe.targetWordCount * recipe.categoryWeight),
    );
    assert.doesNotThrow(() => validateGeneratedPuzzle(puzzle));
  }

  const newspaperRecipe = recipes.recipes.find(
    ({ format }) => format === 'newspaper-arrowword',
  );
  const newspaperPuzzle = manifest.puzzles.find(
    ({ id }) => id === newspaperRecipe?.id,
  );

  assert.ok(newspaperRecipe);
  assert.ok(newspaperPuzzle);
  assert.equal(newspaperPuzzle.format, 'newspaper-arrowword');
  assert.equal(newspaperPuzzle.generation.topologyId, newspaperRecipe.topologyId);
  assert.equal(newspaperPuzzle.cells.filter(({ type }) => type === 'void').length, 0);
  assert.ok(newspaperPuzzle.cells.some(({ type }) => type === 'split-clue'));
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
