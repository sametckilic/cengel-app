const { createHash } = require('node:crypto');

const {
  evaluateNewspaperTopologyAesthetics,
} = require('./newspaper-aesthetics');
const {
  createBentArrowTopology,
  createNewspaper9x10Topology,
  createNewspaperBeginner7x7Topology,
  createNewspaperLarge10x10Topology,
  createNewspaperLarge10x12Topology,
  createNewspaperMedium8x8Topology,
  createNewspaperPrototypeTopology,
  createNewspaperTopology,
} = require('./newspaper-topology');

const DEFAULT_BEAM_WIDTH = 1_000;
const DEFAULT_MAX_CANDIDATES = 12;
const DEFAULT_MINIMUM_BENT_ARROW_COUNT = 2;
const DEFAULT_MAX_MUTATION_DEPTH = 5;
const DEFAULT_SCORE_WINDOW = 4;

function hashFraction(value) {
  const hash = createHash('sha256').update(value).digest();
  return hash.readUInt32BE(0) / 0xffffffff;
}

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

function togglePatternCell(pattern, cellIndex, columnCount) {
  const rowIndex = Math.floor(cellIndex / columnCount);
  const columnIndex = cellIndex % columnCount;
  const row = pattern[rowIndex];
  const replacement = row[columnIndex] === '#' ? '.' : '#';
  const nextPattern = [...pattern];
  nextPattern[rowIndex] =
    row.slice(0, columnIndex) + replacement + row.slice(columnIndex + 1);
  return nextPattern;
}

function createBaseTopologies(rowCount, columnCount) {
  return [
    createNewspaperPrototypeTopology(),
    createNewspaper9x10Topology(),
    createNewspaperBeginner7x7Topology(),
    createNewspaperMedium8x8Topology(),
    createNewspaperLarge10x10Topology(),
    createNewspaperLarge10x12Topology(),
  ].filter(
    (topology) =>
      topology.rowCount === rowCount && topology.columnCount === columnCount,
  );
}

function policyPenalty(report) {
  const { metrics, policy } = report;

  return (
    Math.max(
      0,
      metrics.topRowSingleRightShare - policy.maximumTopRowSingleRightShare,
    ) *
      20 +
    Math.max(0, policy.minimumTopRowDownStarts - metrics.topRowDownStartCount) * 3 +
    Math.max(
      0,
      metrics.singleRightSlotRowShare - policy.maximumSingleRightRowShare,
    ) *
      15 +
    Math.max(
      0,
      metrics.maximumConsecutiveDominantSingleRightRows -
        policy.maximumConsecutiveDominantSingleRightRows,
    ) *
      2 +
    Math.max(0, policy.minimumColumnDownCoverage - metrics.columnDownCoverage) * 20 +
    Math.max(0, policy.minimumDirectionShare - metrics.minorityDirectionShare) * 10 +
    Math.max(0, policy.minimumClueDensity - metrics.clueDensity) * 20 +
    Math.max(0, metrics.clueDensity - policy.maximumClueDensity) * 20 +
    Math.max(0, policy.minimumSplitClueShare - metrics.splitClueShare) * 10 +
    Math.max(0, metrics.splitClueShare - policy.maximumSplitClueShare) * 10
  );
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

  for (const [field, minimum] of [
    ['beamWidth', 1],
    ['maxCandidates', 1],
  ]) {
    if (!Number.isInteger(options[field]) || options[field] < minimum) {
      throw new Error(`${field} must be a positive integer.`);
    }
  }

  if (!Number.isInteger(options.maxMutationDepth) || options.maxMutationDepth < 0) {
    throw new Error('maxMutationDepth must be a non-negative integer.');
  }

  if (
    !Number.isInteger(options.minimumBentArrowCount) ||
    options.minimumBentArrowCount < 0
  ) {
    throw new Error('minimumBentArrowCount must be a non-negative integer.');
  }

  if (typeof options.scoreWindow !== 'number' || options.scoreWindow < 0) {
    throw new Error('scoreWindow must be a non-negative number.');
  }
}

function createState(topology, pattern, baseTopologyId, mutationDepth) {
  const decoratedTopology = createBentArrowTopology(topology);

  return {
    aesthetic: evaluateNewspaperTopologyAesthetics(decoratedTopology),
    baseTopologyId,
    fingerprint: topologyFingerprint(pattern, decoratedTopology),
    mutationDepth,
    pattern,
    topology: decoratedTopology,
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
    state.topology.slots.length === request.targetWordCount &&
    hasRequiredBentArrows(state, options.minimumBentArrowCount)
  );
}

function compareBeamStates(left, right, request) {
  const leftDistance = Math.abs(left.topology.slots.length - request.targetWordCount);
  const rightDistance = Math.abs(right.topology.slots.length - request.targetWordCount);
  const leftPenalty = policyPenalty(left.aesthetic) + leftDistance * 1.5;
  const rightPenalty = policyPenalty(right.aesthetic) + rightDistance * 1.5;

  return (
    leftPenalty - rightPenalty ||
    hashFraction(`${request.seed}:beam:${left.fingerprint}`) -
      hashFraction(`${request.seed}:beam:${right.fingerprint}`)
  );
}

function compareFinalCandidates(left, right, seed) {
  return (
    hashFraction(`${seed}:candidate:${left.fingerprint}`) -
      hashFraction(`${seed}:candidate:${right.fingerprint}`) ||
    right.aesthetic.score - left.aesthetic.score ||
    left.fingerprint.localeCompare(right.fingerprint)
  );
}

function generateNewspaperTopologyCandidates(request, optionOverrides = {}) {
  const options = {
    beamWidth: DEFAULT_BEAM_WIDTH,
    maxCandidates: DEFAULT_MAX_CANDIDATES,
    minimumBentArrowCount: DEFAULT_MINIMUM_BENT_ARROW_COUNT,
    maxMutationDepth: DEFAULT_MAX_MUTATION_DEPTH,
    scoreWindow: DEFAULT_SCORE_WINDOW,
    ...optionOverrides,
  };
  validateOptions(request, options);
  const baseTopologies = createBaseTopologies(request.rowCount, request.columnCount);

  if (baseTopologies.length === 0) {
    throw new Error(
      `No newspaper topology family supports ${request.rowCount}x${request.columnCount}.`,
    );
  }

  const visitedPatterns = new Set();
  let beam = baseTopologies.map((topology) => {
    const pattern = topologyToPattern(topology);
    visitedPatterns.add(pattern.join(''));
    return createState(topology, pattern, topology.id, 0);
  });
  const candidatesByFingerprint = new Map(
    beam.flatMap((state) =>
      isCandidate(state, request, options)
        ? [[state.fingerprint, state]]
        : [],
    ),
  );
  let structurallyValidPatternCount = beam.length;

  for (let mutationDepth = 1; mutationDepth <= options.maxMutationDepth; mutationDepth += 1) {
    const nextBeam = [];

    for (const state of beam) {
      for (
        let cellIndex = 0;
        cellIndex < request.rowCount * request.columnCount;
        cellIndex += 1
      ) {
        const pattern = togglePatternCell(
          state.pattern,
          cellIndex,
          request.columnCount,
        );
        const patternKey = pattern.join('');

        if (visitedPatterns.has(patternKey)) {
          continue;
        }

        visitedPatterns.add(patternKey);

        try {
          const fingerprint = patternFingerprint(pattern);
          const topology = createNewspaperTopology(
            `newspaper-generated-${request.rowCount}x${request.columnCount}-${fingerprint}`,
            pattern,
          );
          const nextState = createState(
            topology,
            pattern,
            state.baseTopologyId,
            mutationDepth,
          );
          structurallyValidPatternCount += 1;
          nextBeam.push(nextState);

          if (isCandidate(nextState, request, options)) {
            candidatesByFingerprint.set(nextState.fingerprint, nextState);
          }
        } catch {
          // Invalid mutations are expected while exploring the topology space.
        }
      }
    }

    nextBeam.sort((left, right) => compareBeamStates(left, right, request));
    beam = nextBeam.slice(0, options.beamWidth);

    if (beam.length === 0) {
      break;
    }
  }

  const discoveredCandidates = [...candidatesByFingerprint.values()].sort(
    (left, right) => right.aesthetic.score - left.aesthetic.score,
  );

  if (discoveredCandidates.length === 0) {
    throw new Error(
      `Could not generate an aesthetic ${request.rowCount}x${request.columnCount} ` +
        `topology with ${request.targetWordCount} words and at least ` +
        `${options.minimumBentArrowCount} bent arrow(s) within ` +
        `${options.maxMutationDepth} mutation step(s).`,
    );
  }

  const bestScore = discoveredCandidates[0].aesthetic.score;
  const highQualityCandidates = discoveredCandidates
    .filter(({ aesthetic }) => aesthetic.score >= bestScore - options.scoreWindow)
    .sort((left, right) => compareFinalCandidates(left, right, request.seed))
    .slice(0, options.maxCandidates);

  return {
    candidates: highQualityCandidates.map((candidate) => ({
      aesthetic: candidate.aesthetic,
      baseTopologyId: candidate.baseTopologyId,
      fingerprint: candidate.fingerprint,
      mutationDepth: candidate.mutationDepth,
      pattern: candidate.pattern,
      topology: candidate.topology,
    })),
    diagnostics: {
      discoveredCandidateCount: discoveredCandidates.length,
      minimumBentArrowCount: options.minimumBentArrowCount,
      returnedCandidateCount: highQualityCandidates.length,
      structurallyValidPatternCount,
      visitedPatternCount: visitedPatterns.size,
    },
  };
}

module.exports = {
  DEFAULT_BEAM_WIDTH,
  DEFAULT_MAX_CANDIDATES,
  DEFAULT_MINIMUM_BENT_ARROW_COUNT,
  DEFAULT_MAX_MUTATION_DEPTH,
  generateNewspaperTopologyCandidates,
  patternFingerprint,
  topologyFingerprint,
  topologyToPattern,
};
