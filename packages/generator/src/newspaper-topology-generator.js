const { createHash } = require('node:crypto');

const {
  evaluateNewspaperTopologyAesthetics,
} = require('./newspaper-aesthetics');
const {
  createCanonicalPatternSample,
  evaluateCanonicalNewspaperLayout,
} = require('./newspaper-canonical-layout');
const {
  createNewspaperArrowwordTopology,
  validateNewspaperTopology,
} = require('./newspaper-topology');

const DEFAULT_MAX_CANDIDATES = 12;
const DEFAULT_MAX_PATTERN_ATTEMPTS = 20_000;
const DEFAULT_MINIMUM_BENT_ARROW_COUNT = 2;

function topologyToPattern(topology) {
  return Array.from({ length: topology.rowCount }, (_, rowIndex) =>
    Array.from({ length: topology.columnCount }, (_, columnIndex) =>
      topology.cells[rowIndex * topology.columnCount + columnIndex].type === 'clue'
        ? '#'
        : '.',
    ).join(''),
  );
}

function patternFingerprint(pattern) {
  return createHash('sha256').update(pattern.join('\n')).digest('hex').slice(0, 16);
}

function topologyFingerprint(pattern, topology) {
  const clueStarts = topology.slots
    .map(
      ({ arrow, clueCellIndex, direction, id }) =>
        `${id}:${clueCellIndex}:${arrow ?? direction}`,
    )
    .join('\n');

  return createHash('sha256')
    .update(`${pattern.join('\n')}\n${clueStarts}`)
    .digest('hex')
    .slice(0, 16);
}

function validateOptions(request, options) {
  if (!Number.isInteger(request.rowCount) || request.rowCount < 3) {
    throw new Error('Topology rowCount must be an integer greater than or equal to 3.');
  }

  if (!Number.isInteger(request.columnCount) || request.columnCount < 3) {
    throw new Error('Topology columnCount must be an integer greater than or equal to 3.');
  }

  if (!Number.isInteger(request.targetWordCount) || request.targetWordCount < 1) {
    throw new Error('Topology targetWordCount must be a positive integer.');
  }

  if (typeof request.seed !== 'string' || request.seed.trim().length === 0) {
    throw new Error('Topology seed must be a non-empty string.');
  }

  for (const field of ['maxCandidates', 'maxPatternAttempts']) {
    if (!Number.isInteger(options[field]) || options[field] < 1) {
      throw new Error(`${field} must be a positive integer.`);
    }
  }

  if (
    !Number.isInteger(options.minimumBentArrowCount) ||
    options.minimumBentArrowCount < 0
  ) {
    throw new Error('minimumBentArrowCount must be a non-negative integer.');
  }

}

function countShortSplitSlots(topology) {
  const clueUseCount = topology.slots.reduce((counts, slot) => {
    counts.set(slot.clueCellIndex, (counts.get(slot.clueCellIndex) ?? 0) + 1);
    return counts;
  }, new Map());

  return topology.slots.filter(
    ({ cellIndices, clueCellIndex }) =>
      cellIndices.length === 2 && clueUseCount.get(clueCellIndex) === 2,
  ).length;
}

function createCandidateState(request, pattern, attemptIndex) {
  const patternId = patternFingerprint(pattern);
  const topology = createNewspaperArrowwordTopology(
    `newspaper-canonical-${request.rowCount}x${request.columnCount}-${patternId}`,
    pattern,
    `${request.seed}:topology:${attemptIndex}:${patternId}`,
  );
  const aesthetic = evaluateNewspaperTopologyAesthetics(topology);
  const canonical = evaluateCanonicalNewspaperLayout(topology);
  const structural = validateNewspaperTopology(topology);
  const shortSplitSlotCount = countShortSplitSlots(topology);
  const shortSlotCount = topology.slots.filter(
    ({ cellIndices }) => cellIndices.length === 2,
  ).length;
  const averageSlotLength =
    topology.slots.reduce(
      (total, { cellIndices }) => total + cellIndices.length,
      0,
    ) / topology.slots.length;

  return {
    aesthetic,
    averageSlotLength,
    attemptIndex,
    canonical,
    fingerprint: topologyFingerprint(pattern, topology),
    intersectionCellCount: structural.intersectionCellCount,
    pattern,
    shortSlotCount,
    shortSplitSlotCount,
    splitClueCellCount: structural.splitClueCellCount,
    topology,
  };
}

function hasRequiredBentArrows(state, minimumBentArrowCount) {
  const bentArrowCount = state.topology.slots.filter(
    ({ arrow, direction }) => arrow !== undefined && arrow !== direction,
  ).length;

  return bentArrowCount >= minimumBentArrowCount;
}

function isCandidate(state, request, options) {
  return (
    state.aesthetic.passed &&
    state.canonical.passed &&
    state.topology.slots.length === request.targetWordCount &&
    hasRequiredBentArrows(state, options.minimumBentArrowCount)
  );
}

function compareCandidateQuality(left, right) {
  return (
    left.splitClueCellCount - right.splitClueCellCount ||
    left.intersectionCellCount - right.intersectionCellCount ||
    left.shortSlotCount - right.shortSlotCount ||
    left.shortSplitSlotCount - right.shortSplitSlotCount ||
    right.averageSlotLength - left.averageSlotLength ||
    right.aesthetic.score - left.aesthetic.score ||
    left.attemptIndex - right.attemptIndex
  );
}

function generateNewspaperTopologyCandidates(request, optionOverrides = {}) {
  const options = {
    maxCandidates: DEFAULT_MAX_CANDIDATES,
    maxPatternAttempts: DEFAULT_MAX_PATTERN_ATTEMPTS,
    minimumBentArrowCount: DEFAULT_MINIMUM_BENT_ARROW_COUNT,
    ...optionOverrides,
  };
  validateOptions(request, options);
  const candidatesByFingerprint = new Map();
  const visitedPatterns = new Set();
  let structurallyValidPatternCount = 0;

  for (
    let attemptIndex = 0;
    attemptIndex < options.maxPatternAttempts;
    attemptIndex += 1
  ) {
    const pattern = createCanonicalPatternSample(request, attemptIndex, {
      maximumExtraClueCount: options.maximumExtraClueCount,
    });
    const patternKey = pattern.join('');

    if (visitedPatterns.has(patternKey)) {
      continue;
    }

    visitedPatterns.add(patternKey);

    try {
      const state = createCandidateState(request, pattern, attemptIndex);
      structurallyValidPatternCount += 1;

      if (isCandidate(state, request, options)) {
        candidatesByFingerprint.set(state.fingerprint, state);
      }
    } catch {
      // Most sampled masks are intentionally rejected by the topology contract.
    }
  }

  const discoveredCandidates = [...candidatesByFingerprint.values()].sort(
    compareCandidateQuality,
  );

  if (discoveredCandidates.length === 0) {
    throw new Error(
      `Could not generate a canonical ${request.rowCount}x${request.columnCount} ` +
        `newspaper topology with ${request.targetWordCount} words within ` +
        `${options.maxPatternAttempts} deterministic pattern attempt(s).`,
    );
  }

  const selectedCandidates = discoveredCandidates
    .slice(0, options.maxCandidates);

  return {
    candidates: selectedCandidates.map((candidate) => ({
      aesthetic: candidate.aesthetic,
      averageSlotLength: candidate.averageSlotLength,
      baseTopologyId: `newspaper-canonical-${request.rowCount}x${request.columnCount}`,
      canonical: candidate.canonical,
      fingerprint: candidate.fingerprint,
      intersectionCellCount: candidate.intersectionCellCount,
      mutationDepth: 0,
      pattern: candidate.pattern,
      shortSlotCount: candidate.shortSlotCount,
      shortSplitSlotCount: candidate.shortSplitSlotCount,
      splitClueCellCount: candidate.splitClueCellCount,
      topology: candidate.topology,
    })),
    diagnostics: {
      discoveredCandidateCount: discoveredCandidates.length,
      generationMode: 'outside-in-canonical',
      maxPatternAttempts: options.maxPatternAttempts,
      returnedCandidateCount: selectedCandidates.length,
      structurallyValidPatternCount,
      visitedPatternCount: visitedPatterns.size,
    },
  };
}

module.exports = {
  DEFAULT_MAX_CANDIDATES,
  DEFAULT_MAX_PATTERN_ATTEMPTS,
  DEFAULT_MINIMUM_BENT_ARROW_COUNT,
  generateNewspaperTopologyCandidates,
  patternFingerprint,
  topologyFingerprint,
  topologyToPattern,
};
