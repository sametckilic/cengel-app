#!/usr/bin/env node

const { readFile } = require('node:fs/promises');
const path = require('node:path');

const {
  ROTATION_ANCHOR_DATE,
  addDaysToIsoDate,
  createScheduledDailyPublication,
} = require('../src/daily-puzzle-schedule');
const {
  NEWSPAPER_V2_RECIPE_MATRIX,
} = require('../src/newspaper-recipe-matrix');

const CATALOG_PATH = path.resolve(
  process.cwd(),
  'apps/mobile/data/generated/clue-catalog.json',
);
const MATRIX_REVISION = 'matrix-v1';

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const summaries = [];

  for (const [index, expectedProfile] of NEWSPAPER_V2_RECIPE_MATRIX.entries()) {
    const date = addDaysToIsoDate(ROTATION_ANCHOR_DATE, index);
    const startedAt = Date.now();
    const publication = createScheduledDailyPublication(
      catalog,
      { date, revision: MATRIX_REVISION },
      { generatorVersion: 'newspaper-v2' },
    );

    if (publication.profileId !== expectedProfile.profileId) {
      throw new Error(
        `Matrix profile "${expectedProfile.profileId}" could not produce ${date}; ` +
          `generation fell back to "${publication.profileId}".`,
      );
    }

    const { metrics } = publication.quality;
    const expectedRequiredThemedWordCount = Math.ceil(
      expectedProfile.targetWordCount * expectedProfile.categoryWeight,
    );

    if (
      publication.quality.passed !== true ||
      publication.puzzle.rowCount !== expectedProfile.rowCount ||
      publication.puzzle.columnCount !== expectedProfile.columnCount ||
      publication.puzzle.difficulty !== expectedProfile.difficulty ||
      publication.puzzle.words.length !== expectedProfile.targetWordCount ||
      JSON.stringify(publication.puzzle.categories) !==
        JSON.stringify(expectedProfile.categories) ||
      publication.puzzle.cells.some(({ type }) =>
        ['block', 'void'].includes(type),
      ) ||
      metrics.requiredThemedWordCount !== expectedRequiredThemedWordCount ||
      metrics.themedWordCount < expectedRequiredThemedWordCount ||
      metrics.themedWordCount <= publication.puzzle.words.length / 2
    ) {
      throw new Error(
        `Matrix profile "${expectedProfile.profileId}" produced an invalid contract.`,
      );
    }

    summaries.push({
      date,
      difficulty: publication.puzzle.difficulty,
      generationAttempt: Number(publication.revision.match(/-a(\d+)$/)?.[1]),
      profileId: publication.profileId,
      size: `${publication.puzzle.rowCount}x${publication.puzzle.columnCount}`,
      themedWords: `${metrics.themedWordCount}/${metrics.requiredThemedWordCount}`,
      validationMilliseconds: Date.now() - startedAt,
      words: publication.puzzle.words.length,
    });
  }

  console.log(JSON.stringify(summaries, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
