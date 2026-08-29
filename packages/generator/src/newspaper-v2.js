const { DEFAULT_CLUE_TEXT_POLICY, resolveClueTextPolicy } = require('./clue-text-fit');
const { fillNewspaperTopology } = require('./newspaper-fill');
const {
  generateNewspaperTopologyCandidates,
} = require('./newspaper-topology-generator');

const DEFAULT_V2_OPTIONS = Object.freeze({
  maximumFillAttempts: 8,
  maximumSuccessfulFills: 3,
  maxSearchNodesPerTopology: 25_000,
});

function createNewspaperV2GenerationOptions(request) {
  if (request.rowCount >= 10) {
    return {
      maximumFillAttempts: 8,
      maximumSuccessfulFills: 1,
      maxSearchNodesPerTopology: 5_000,
      topology: { maxCandidates: 8, maxPatternAttempts: 20_000 },
    };
  }

  return {
    maximumFillAttempts: 12,
    maximumSuccessfulFills: 1,
    maxSearchNodesPerTopology: 5_000,
    topology: { maxCandidates: 12, maxPatternAttempts: 20_000 },
  };
}

function resolveV2Options(overrides = {}) {
  const options = {
    ...DEFAULT_V2_OPTIONS,
    ...overrides,
    clueTextPolicy: resolveClueTextPolicy(
      overrides.clueTextPolicy ?? DEFAULT_CLUE_TEXT_POLICY,
    ),
    topology: { ...(overrides.topology ?? {}) },
  };

  for (const field of [
    'maximumFillAttempts',
    'maximumSuccessfulFills',
    'maxSearchNodesPerTopology',
  ]) {
    if (!Number.isInteger(options[field]) || options[field] < 1) {
      throw new Error(`${field} must be a positive integer.`);
    }
  }

  if (options.maximumSuccessfulFills > options.maximumFillAttempts) {
    throw new Error(
      'maximumSuccessfulFills cannot be greater than maximumFillAttempts.',
    );
  }

  return options;
}

function scoreFilledCandidate(candidate, fillResult, clueTextPolicy) {
  const wordCount = fillResult.puzzle.words.length;
  const fallbackShare = fillResult.diagnostics.fallbackWordCount / wordCount;
  const clueText = fillResult.diagnostics.clueText;
  const singleClueLoad =
    clueText.maximumSingleUnits / clueTextPolicy.maximumSingleClueUnits;
  const splitClueLoad =
    clueText.maximumSplitUnits / clueTextPolicy.maximumSplitClueUnits;

  return Number(
    (
      candidate.aesthetic.score -
      fallbackShare * 20 -
      singleClueLoad * 2 -
      splitClueLoad * 3
    ).toFixed(4),
  );
}

function compareTopologyAttempts(left, right) {
  return (
    left.candidate.splitClueCellCount - right.candidate.splitClueCellCount ||
    left.candidate.intersectionCellCount - right.candidate.intersectionCellCount ||
    left.candidate.shortSlotCount - right.candidate.shortSlotCount ||
    left.candidate.shortSplitSlotCount - right.candidate.shortSplitSlotCount ||
    right.candidate.averageSlotLength - left.candidate.averageSlotLength ||
    right.candidate.aesthetic.score - left.candidate.aesthetic.score ||
    left.discoveryIndex - right.discoveryIndex
  );
}

function compareFilledCandidates(left, right) {
  return right.score - left.score || left.attemptIndex - right.attemptIndex;
}

function generateNewspaperPuzzleV2(catalogEntries, request, optionOverrides = {}) {
  const options = resolveV2Options(optionOverrides);
  const topologyResult = generateNewspaperTopologyCandidates(
    request,
    options.topology,
  );
  const topologyAttempts = topologyResult.candidates
    .map((candidate, discoveryIndex) => ({ candidate, discoveryIndex }))
    .sort(compareTopologyAttempts)
    .slice(0, options.maximumFillAttempts);
  const failedFills = [];
  const successfulFills = [];
  const themePrimaryDirections = ['right', 'down'];

  for (const [attemptIndex, { candidate }] of topologyAttempts.entries()) {
    for (const themePrimaryDirection of themePrimaryDirections) {
      try {
        const maxSearchNodes =
          candidate.mutationDepth === 0
            ? options.maxSearchNodesPerTopology
            : Math.min(options.maxSearchNodesPerTopology, 2_500);
        const fillResult = fillNewspaperTopology(
          catalogEntries,
          request,
          candidate.topology,
          {
            clueTextPolicy: options.clueTextPolicy,
            maxSearchNodes,
            preferCrossingSupport: true,
            themePrimaryDirection,
          },
        );
        const score = scoreFilledCandidate(
          candidate,
          fillResult,
          options.clueTextPolicy,
        );

        successfulFills.push({
          attemptIndex,
          candidate,
          fillResult,
          score,
          themePrimaryDirection,
        });
        break;
      } catch (error) {
        failedFills.push({
          fingerprint: candidate.fingerprint,
          message: error instanceof Error ? error.message : String(error),
          themePrimaryDirection,
        });
      }
    }

    if (successfulFills.length >= options.maximumSuccessfulFills) {
      break;
    }
  }

  if (successfulFills.length === 0) {
    const failureSummary = failedFills
      .map(
        ({ fingerprint, message, themePrimaryDirection }) =>
          `${fingerprint}/${themePrimaryDirection}: ${message}`,
      )
      .join(' | ');
    throw new Error(
      `Could not fill any V2 topology candidate for puzzle "${request.id}".` +
        (failureSummary ? ` ${failureSummary}` : ''),
    );
  }

  successfulFills.sort(compareFilledCandidates);
  const selected = successfulFills[0];
  const puzzle = {
    ...selected.fillResult.puzzle,
    generation: {
      ...selected.fillResult.puzzle.generation,
      aestheticScore: selected.candidate.aesthetic.score,
      generatorVersion: 'newspaper-v2',
      topologyFingerprint: selected.candidate.fingerprint,
    },
  };

  return {
    puzzle,
    diagnostics: {
      ...selected.fillResult.diagnostics,
      aesthetic: selected.candidate.aesthetic,
      canonical: selected.candidate.canonical,
      failedFills,
      fillAttemptCount: failedFills.length + successfulFills.length,
      selectedScore: selected.score,
      successfulFillCount: successfulFills.length,
      themePrimaryDirection: selected.themePrimaryDirection,
      topologyGeneration: topologyResult.diagnostics,
    },
  };
}

module.exports = {
  DEFAULT_V2_OPTIONS,
  createNewspaperV2GenerationOptions,
  generateNewspaperPuzzleV2,
  resolveV2Options,
  scoreFilledCandidate,
};
