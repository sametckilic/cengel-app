#!/usr/bin/env node

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const manifest = require('../../../apps/mobile/data/generated/puzzles.json');
const recipes = require('../../../apps/mobile/data/puzzle-recipes.json');
const {
  analyzeCatalogReadiness,
  analyzeNewspaperPuzzle,
  estimateDenseWordDemand,
} = require('../src/newspaper-grid');

const REFERENCE_GRID_SIZES = [
  { rowCount: 8, columnCount: 8 },
  { rowCount: 10, columnCount: 10 },
  { rowCount: 12, columnCount: 12 },
];

function main() {
  const catalogReport = analyzeCatalogReadiness(catalog.entries, REFERENCE_GRID_SIZES);
  const recipeById = new Map(recipes.recipes.map((recipe) => [recipe.id, recipe]));
  const currentPuzzles = manifest.puzzles.map((puzzle) => {
    const quality = analyzeNewspaperPuzzle(puzzle);
    const recipe = recipeById.get(puzzle.id);
    const denseDemand = estimateDenseWordDemand(
      puzzle.rowCount,
      puzzle.columnCount,
      catalogReport.answerLengthAverage,
    );

    return {
      id: puzzle.id,
      size: `${puzzle.rowCount}x${puzzle.columnCount}`,
      targetWordCount: recipe?.targetWordCount ?? puzzle.words.length,
      estimatedWordDemand: {
        minimum: denseDemand.minimumWordCount,
        maximum: denseDemand.maximumWordCount,
      },
      newspaperReady: quality.newspaperReady,
      occupiedRatio: quality.occupiedRatio,
      voidCells: quality.cellTypeCounts.void,
      splitClueCells: quality.cellTypeCounts['split-clue'],
      orphanLetters: quality.orphanLetterIndices.length,
      issues: quality.issues,
    };
  });
  const blockingGaps = [];

  if (catalogReport.missingRecommendedAnswerLengths.length > 0) {
    blockingGaps.push(
      `Catalog has no accepted answers of length: ${catalogReport.missingRecommendedAnswerLengths.join(', ')}.`,
    );
  }

  if (currentPuzzles.some(({ newspaperReady }) => !newspaperReady)) {
    blockingGaps.push('No current puzzle satisfies the newspaper-ready grid contract.');
  }

  if (currentPuzzles.every(({ splitClueCells }) => splitClueCells === 0)) {
    blockingGaps.push('The current generated manifest contains no split clue cells.');
  }

  if (
    currentPuzzles.some(
      ({ estimatedWordDemand, targetWordCount }) =>
        targetWordCount < estimatedWordDemand.minimum,
    )
  ) {
    blockingGaps.push(
      'At least one recipe requests fewer words than the catalog-based dense-grid estimate.',
    );
  }

  console.log(
    JSON.stringify(
      {
        schemaVersion: 1,
        catalog: catalogReport,
        currentPuzzles,
        blockingGaps,
      },
      null,
      2,
    ),
  );
}

main();
