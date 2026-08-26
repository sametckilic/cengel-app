const { fillNewspaperTopology } = require('./newspaper-fill');
const { analyzeNewspaperPuzzle } = require('./newspaper-grid');
const { createNewspaperTopologyById } = require('./newspaper-topology');
const {
  createNewspaperV2GenerationOptions,
  generateNewspaperPuzzleV2,
} = require('./newspaper-v2');
const { validateGeneratedPuzzle, validateRecipeDocument } = require('./puzzle-manifest');

const DEFAULT_DAILY_QUALITY_POLICY = Object.freeze({
  maximumFallbackWordShare: 0.25,
  minimumAnswerLengthAverage: 3.5,
  minimumDirectionShare: 0.3,
  minimumIntersectionRatio: 0.6,
});
const DEFAULT_V2_DAILY_QUALITY_POLICY = Object.freeze({
  ...DEFAULT_DAILY_QUALITY_POLICY,
  maximumFallbackWordShare: 0.4,
  minimumAnswerLengthAverage: 3.2,
});

function roundRatio(value) {
  return Number(value.toFixed(4));
}

function resolveQualityPolicy(overrides = {}) {
  const policy = { ...DEFAULT_DAILY_QUALITY_POLICY, ...overrides };
  const ratioFields = [
    'maximumFallbackWordShare',
    'minimumDirectionShare',
  ];

  for (const field of ratioFields) {
    if (typeof policy[field] !== 'number' || policy[field] < 0 || policy[field] > 1) {
      throw new Error(`${field} must be a number between 0 and 1.`);
    }
  }

  if (policy.minimumDirectionShare > 0.5) {
    throw new Error('minimumDirectionShare cannot be greater than 0.5.');
  }

  for (const field of ['minimumAnswerLengthAverage', 'minimumIntersectionRatio']) {
    if (typeof policy[field] !== 'number' || policy[field] < 0) {
      throw new Error(`${field} must be a non-negative number.`);
    }
  }

  return policy;
}

function evaluateDailyPuzzleQuality(puzzle, diagnostics, policyOverrides) {
  const policy = resolveQualityPolicy(policyOverrides);
  const newspaperReport = analyzeNewspaperPuzzle(puzzle);
  const wordCount = puzzle.words.length;
  const themedWordCount = puzzle.words.filter(({ category }) =>
    puzzle.categories.includes(category),
  ).length;
  const requiredThemedWordCount = Math.ceil(
    wordCount * puzzle.generation.categoryWeight,
  );
  const fallbackWordCount = diagnostics?.fallbackWordCount;
  const intersectionRatio =
    wordCount > 0 ? newspaperReport.intersectionCellCount / wordCount : 0;
  const directionShare =
    wordCount > 0
      ? Math.min(
          newspaperReport.directionCounts.down,
          newspaperReport.directionCounts.right,
        ) / wordCount
      : 0;
  const fallbackWordShare =
    wordCount > 0 && Number.isInteger(fallbackWordCount)
      ? fallbackWordCount / wordCount
      : null;
  const issues = [...newspaperReport.issues];

  if (puzzle.format !== 'newspaper-arrowword') {
    issues.push('Daily puzzle must use newspaper-arrowword format.');
  }

  if (intersectionRatio < policy.minimumIntersectionRatio) {
    issues.push(
      `Intersection ratio ${roundRatio(intersectionRatio)} is below ` +
        `${policy.minimumIntersectionRatio}.`,
    );
  }

  if (directionShare < policy.minimumDirectionShare) {
    issues.push(
      `Minority direction share ${roundRatio(directionShare)} is below ` +
        `${policy.minimumDirectionShare}.`,
    );
  }

  if (newspaperReport.answerLengthAverage < policy.minimumAnswerLengthAverage) {
    issues.push(
      `Average answer length ${newspaperReport.answerLengthAverage} is below ` +
        `${policy.minimumAnswerLengthAverage}.`,
    );
  }

  if (fallbackWordShare === null) {
    issues.push('Fallback word diagnostics are required.');
  } else if (fallbackWordShare > policy.maximumFallbackWordShare) {
    issues.push(
      `Fallback word share ${roundRatio(fallbackWordShare)} exceeds ` +
        `${policy.maximumFallbackWordShare}.`,
    );
  }

  if (themedWordCount < requiredThemedWordCount) {
    issues.push(
      `Puzzle has ${themedWordCount} themed words; ${requiredThemedWordCount} required.`,
    );
  }

  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      answerLengthAverage: newspaperReport.answerLengthAverage,
      directionShare: roundRatio(directionShare),
      fallbackWordCount,
      fallbackWordShare:
        fallbackWordShare === null ? null : roundRatio(fallbackWordShare),
      intersectionCount: newspaperReport.intersectionCellCount,
      intersectionRatio: roundRatio(intersectionRatio),
      occupiedRatio: newspaperReport.occupiedRatio,
      requiredThemedWordCount,
      themedWordCount,
      wordCount,
    },
    policy,
  };
}

function buildDailyPuzzleCandidate(catalogEntries, recipe, policyOverrides) {
  validateRecipeDocument({ schemaVersion: 1, recipes: [recipe] });
  const { diagnostics, puzzle } =
    recipe.generatorVersion === 'newspaper-v2'
      ? generateNewspaperPuzzleV2(
          catalogEntries,
          recipe,
          createNewspaperV2GenerationOptions(recipe),
        )
      : fillNewspaperTopology(
          catalogEntries,
          recipe,
          createNewspaperTopologyById(recipe.topologyId),
        );

  validateGeneratedPuzzle(puzzle);
  const qualityPolicy =
    recipe.generatorVersion === 'newspaper-v2'
      ? { ...DEFAULT_V2_DAILY_QUALITY_POLICY, ...policyOverrides }
      : policyOverrides;
  const quality = evaluateDailyPuzzleQuality(puzzle, diagnostics, qualityPolicy);

  if (!quality.passed) {
    throw new Error(
      `Daily puzzle "${puzzle.id}" failed quality gate: ${quality.issues.join(' ')}`,
    );
  }

  return { diagnostics, puzzle, quality };
}

module.exports = {
  DEFAULT_DAILY_QUALITY_POLICY,
  DEFAULT_V2_DAILY_QUALITY_POLICY,
  buildDailyPuzzleCandidate,
  evaluateDailyPuzzleQuality,
  resolveQualityPolicy,
};
