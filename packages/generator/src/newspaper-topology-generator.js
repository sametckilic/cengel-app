const { createHash } = require('node:crypto');

const {
  evaluateNewspaperTopologyAesthetics,
} = require('./newspaper-aesthetics');
const {
  createNewspaperArrowwordTopology,
} = require('./newspaper-topology');

const DEFAULT_BEAM_WIDTH = 200;
const DEFAULT_MAX_CANDIDATES = 12;
const DEFAULT_MINIMUM_BENT_ARROW_COUNT = 2;
const DEFAULT_MAX_MUTATION_DEPTH = 1;
const DEFAULT_SCORE_WINDOW = 4;
// Every family starts from a top-left paired clue, continues with bent starts
// across the top and left edges, then tiles the remaining area with interior
// straight starts. The fill step may choose a resilient variant for the same
// dimensions without changing that visual grammar.
const SCAFFOLD_BASE_PATTERNS = Object.freeze({
  '7x7': Object.freeze([
    '#.#..#.',
    '.....#.',
    '#.#....',
    '.......',
    '#..#...',
    '.......',
    '#......',
  ]),
  '8x8': Object.freeze([
    Object.freeze([
      '#.#...#.',
      '........',
      '#.#.....',
      '...#....',
      '.#.....#',
      '...#....',
      '#..#....',
      '........',
    ]),
    Object.freeze([
      '#.#...#.',
      '..#.....',
      '#.#.....',
      '........',
      '...#...#',
      '....#...',
      '##..#...',
      '........',
    ]),
  ]),
  '9x10': Object.freeze([
    '#.#.....#.',
    '..........',
    '#.#....#..',
    '...#....#.',
    '.#..#.....',
    '...##.....',
    '....#....#',
    '#.....#...',
    '..........',
  ]),
  '10x10': Object.freeze([
    '#.#.....#.',
    '.....#....',
    '#.#...#..#',
    '....#.....',
    '...#.#.#..',
    '..#.....#.',
    '..........',
    '.......#..',
    '#...#..#..',
    '..........',
  ]),
  '10x12': Object.freeze([
    Object.freeze([
      '#.#.#.....#.',
      '....#.......',
      '#.#.#.....#.',
      '.......#....',
      '...#.....#..',
      '.....#......',
      '#......#....',
      '...#.....#..',
      '#.#.........',
      '....#.......',
    ]),
    Object.freeze([
      '#.#.#.....#.',
      '....#.......',
      '#.#.#.....#.',
      '.......#....',
      '...#.....#..',
      '.....#......',
      '#......#....',
      '...#.....#.#',
      '#.#....#....',
      '....#.......',
    ]),
  ]),
});

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

function createBasePatterns(rowCount, columnCount) {
  const pattern = SCAFFOLD_BASE_PATTERNS[`${rowCount}x${columnCount}`];

  if (!pattern) {
    return [];
  }

  return typeof pattern[0] === 'string' ? [pattern] : pattern;
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
    Math.max(0, metrics.splitClueShare - policy.maximumSplitClueShare) * 10 +
    Math.max(0, policy.minimumBentArrowShare - metrics.bentArrowShare) * 20 +
    Math.max(
      0,
      policy.minimumIndependentBentArrowCount -
        metrics.independentBentArrowCount,
    ) * 3 +
    Math.max(0, policy.minimumClueRowCoverage - metrics.clueRowCoverage) * 15 +
    Math.max(0, policy.minimumClueColumnCoverage - metrics.clueColumnCoverage) *
      15 +
    Math.max(0, policy.minimumInteriorClueShare - metrics.interiorClueShare) * 15 +
    Math.max(
      0,
      metrics.leadingEdgeClueShare - policy.maximumLeadingEdgeClueShare,
    ) *
      15 +
    Number(
      policy.requireTopLeftScaffoldPair &&
        !metrics.hasTopLeftScaffoldPair,
    ) *
      20 +
    Math.max(
      0,
      policy.minimumTopEdgeBentDownCount - metrics.topEdgeBentDownCount,
    ) *
      5 +
    Math.max(
      0,
      policy.minimumLeftEdgeBentRightCount - metrics.leftEdgeBentRightCount,
    ) *
      5 +
    Math.max(
      0,
      policy.minimumTopEdgeScaffoldSpan - metrics.topEdgeScaffoldSpan,
    ) *
      15 +
    Math.max(
      0,
      policy.minimumLeftEdgeScaffoldSpan - metrics.leftEdgeScaffoldSpan,
    ) *
      15 +
    Math.max(
      0,
      policy.minimumInteriorStraightSplitCount -
        metrics.interiorStraightSplitCount,
    ) *
      5 +
    Math.max(
      0,
      metrics.topRowRightSlotCount - policy.maximumTopRowRightSlotCount,
    ) *
      5
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

function createState(pattern, baseTopologyId, mutationDepth, seed) {
  const fingerprint = patternFingerprint(pattern);
  const topology = createNewspaperArrowwordTopology(
    `newspaper-scaffold-${pattern.length}x${pattern[0].length}-${fingerprint}`,
    pattern,
    `${seed}:${fingerprint}`,
  );

  return {
    aesthetic: evaluateNewspaperTopologyAesthetics(topology),
    baseTopologyId,
    fingerprint: topologyFingerprint(pattern, topology),
    mutationDepth,
    pattern,
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
  const basePatterns = createBasePatterns(request.rowCount, request.columnCount);

  if (basePatterns.length === 0) {
    throw new Error(
      `No newspaper topology family supports ${request.rowCount}x${request.columnCount}.`,
    );
  }

  const visitedPatterns = new Set();
  let beam = basePatterns.map((pattern, basePatternIndex) => {
    visitedPatterns.add(pattern.join(''));
    return createState(
      pattern,
      `newspaper-scaffold-${request.rowCount}x${request.columnCount}-base-${basePatternIndex + 1}`,
      0,
      request.seed,
    );
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
          const nextState = createState(
            pattern,
            state.baseTopologyId,
            mutationDepth,
            request.seed,
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
  const seededHighQualityCandidates = discoveredCandidates
    .filter(({ aesthetic }) => aesthetic.score >= bestScore - options.scoreWindow)
    .sort((left, right) => compareFinalCandidates(left, right, request.seed));
  const baseCandidates = discoveredCandidates
    .filter(({ mutationDepth }) => mutationDepth === 0)
    .slice(0, options.maxCandidates);
  const baseFingerprints = new Set(
    baseCandidates.map(({ fingerprint }) => fingerprint),
  );
  const selectedCandidates = [
    ...seededHighQualityCandidates
      .filter(({ fingerprint }) => !baseFingerprints.has(fingerprint))
      .slice(0, options.maxCandidates - baseCandidates.length),
    ...baseCandidates,
  ];

  return {
    candidates: selectedCandidates.map((candidate) => ({
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
      returnedCandidateCount: selectedCandidates.length,
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
