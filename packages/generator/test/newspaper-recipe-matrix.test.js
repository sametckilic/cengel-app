const assert = require('node:assert/strict');
const test = require('node:test');

const { DAILY_PUZZLE_PROFILES } = require('../src/daily-puzzle-profiles');
const { DAILY_V2_PROFILE_ROTATION } = require('../src/daily-puzzle-schedule');
const {
  NEWSPAPER_V2_DIFFICULTIES,
  NEWSPAPER_V2_RECIPE_MATRIX,
  NEWSPAPER_V2_SIZE_VARIANTS,
} = require('../src/newspaper-recipe-matrix');

test('defines one explicit profile for every V2 size and difficulty', () => {
  const expectedCellCount =
    NEWSPAPER_V2_DIFFICULTIES.length * NEWSPAPER_V2_SIZE_VARIANTS.length;
  const profileIds = NEWSPAPER_V2_RECIPE_MATRIX.map(({ profileId }) => profileId);

  assert.equal(NEWSPAPER_V2_RECIPE_MATRIX.length, 20);
  assert.equal(NEWSPAPER_V2_RECIPE_MATRIX.length, expectedCellCount);
  assert.equal(new Set(profileIds).size, expectedCellCount);
  assert.deepEqual(DAILY_V2_PROFILE_ROTATION, profileIds);

  for (const size of NEWSPAPER_V2_SIZE_VARIANTS) {
    const profiles = NEWSPAPER_V2_RECIPE_MATRIX.filter(
      ({ columnCount, rowCount }) =>
        rowCount === size.rowCount && columnCount === size.columnCount,
    );

    assert.deepEqual(
      new Set(profiles.map(({ difficulty }) => difficulty)),
      new Set(NEWSPAPER_V2_DIFFICULTIES),
    );
    assert.ok(
      profiles.every(
        ({ categoryWeight, targetWordCount }) =>
          categoryWeight > 0.5 && targetWordCount === size.targetWordCount,
      ),
    );
  }

  for (const { profileId, ...matrixProfile } of NEWSPAPER_V2_RECIPE_MATRIX) {
    const registeredProfile = DAILY_PUZZLE_PROFILES[profileId];

    assert.ok(registeredProfile, `Missing daily profile ${profileId}`);
    assert.deepEqual(registeredProfile, matrixProfile);
    assert.ok(Object.isFrozen(registeredProfile));
  }
});

test('varies both size and difficulty on consecutive V2 rotation days', () => {
  for (let index = 1; index < NEWSPAPER_V2_RECIPE_MATRIX.length; index += 1) {
    const previous = NEWSPAPER_V2_RECIPE_MATRIX[index - 1];
    const current = NEWSPAPER_V2_RECIPE_MATRIX[index];

    assert.notEqual(current.difficulty, previous.difficulty);
    assert.notDeepEqual(
      [current.rowCount, current.columnCount],
      [previous.rowCount, previous.columnCount],
    );
  }
});
