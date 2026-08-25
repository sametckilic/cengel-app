const { validateNewspaperTopology } = require('./newspaper-topology');

const DEFAULT_NEWSPAPER_AESTHETIC_POLICY = Object.freeze({
  dominantSingleRightRowMinimumShare: 0.5,
  maximumClueDensity: 0.35,
  maximumConsecutiveDominantSingleRightRows: 2,
  maximumSingleRightRowShare: 0.7,
  maximumSplitClueShare: 0.45,
  maximumTopRowSingleRightShare: 0.5,
  minimumClueDensity: 0.18,
  minimumColumnDownCoverage: 0.75,
  minimumDirectionShare: 0.35,
  minimumSplitClueShare: 0.1,
  minimumTopRowDownStarts: 2,
});

function roundRatio(value) {
  return Number(value.toFixed(4));
}

function longestConsecutiveRun(values) {
  let longest = 0;
  let current = 0;

  for (const value of values) {
    current = value ? current + 1 : 0;
    longest = Math.max(longest, current);
  }

  return longest;
}

function resolveAestheticPolicy(overrides = {}) {
  const policy = { ...DEFAULT_NEWSPAPER_AESTHETIC_POLICY, ...overrides };
  const ratioFields = [
    'dominantSingleRightRowMinimumShare',
    'maximumClueDensity',
    'maximumSingleRightRowShare',
    'maximumSplitClueShare',
    'maximumTopRowSingleRightShare',
    'minimumClueDensity',
    'minimumColumnDownCoverage',
    'minimumDirectionShare',
    'minimumSplitClueShare',
  ];

  for (const field of ratioFields) {
    if (typeof policy[field] !== 'number' || policy[field] < 0 || policy[field] > 1) {
      throw new Error(`${field} must be a number between 0 and 1.`);
    }
  }

  if (policy.minimumClueDensity > policy.maximumClueDensity) {
    throw new Error('minimumClueDensity cannot be greater than maximumClueDensity.');
  }

  if (policy.minimumSplitClueShare > policy.maximumSplitClueShare) {
    throw new Error('minimumSplitClueShare cannot be greater than maximumSplitClueShare.');
  }

  if (
    !Number.isInteger(policy.maximumConsecutiveDominantSingleRightRows) ||
    policy.maximumConsecutiveDominantSingleRightRows < 0
  ) {
    throw new Error('maximumConsecutiveDominantSingleRightRows must be a non-negative integer.');
  }

  if (!Number.isInteger(policy.minimumTopRowDownStarts) || policy.minimumTopRowDownStarts < 0) {
    throw new Error('minimumTopRowDownStarts must be a non-negative integer.');
  }

  return policy;
}

function scoreAestheticMetrics(metrics) {
  const directionBalance =
    1 -
    Math.abs(metrics.directionCounts.right - metrics.directionCounts.down) /
      (metrics.directionCounts.right + metrics.directionCounts.down);
  const clueDensityFit = Math.max(0, 1 - Math.abs(metrics.clueDensity - 0.26) / 0.17);
  const splitClueFit = Math.max(0, 1 - Math.abs(metrics.splitClueShare - 0.25) / 0.25);
  const topRowVariety =
    (Math.min(metrics.topRowRightSlotCount, 2) / 2 +
      Math.min(metrics.topRowDownStartCount, 2) / 2) /
    2;
  const consecutiveRunControl = Math.max(
    0,
    1 - metrics.maximumConsecutiveDominantSingleRightRows / 4,
  );
  const slotLengthVariety = Math.min(metrics.distinctSlotLengths.length / 6, 1);
  const score =
    metrics.columnDownCoverage * 20 +
    (1 - metrics.singleRightSlotRowShare) * 15 +
    directionBalance * 15 +
    clueDensityFit * 15 +
    splitClueFit * 10 +
    topRowVariety * 15 +
    consecutiveRunControl * 5 +
    slotLengthVariety * 5;

  return roundRatio(score);
}

function evaluateNewspaperTopologyAesthetics(topology, policyOverrides) {
  const structuralReport = validateNewspaperTopology(topology);
  const policy = resolveAestheticPolicy(policyOverrides);
  const { columnCount, rowCount, slots } = topology;
  const rightSlots = slots.filter(({ direction }) => direction === 'right');
  const downSlots = slots.filter(({ direction }) => direction === 'down');
  const rightSlotsByRow = Array.from({ length: rowCount }, () => []);
  const downSlotsByColumn = Array.from({ length: columnCount }, () => []);
  const clueUseCount = new Map();

  for (const slot of slots) {
    clueUseCount.set(slot.clueCellIndex, (clueUseCount.get(slot.clueCellIndex) ?? 0) + 1);

    if (slot.direction === 'right') {
      rightSlotsByRow[Math.floor(slot.clueCellIndex / columnCount)].push(slot);
    } else {
      downSlotsByColumn[slot.clueCellIndex % columnCount].push(slot);
    }
  }

  const topRowRightSlots = rightSlotsByRow[0];
  const topRowDownStartCount = downSlots.filter(
    ({ clueCellIndex }) => Math.floor(clueCellIndex / columnCount) === 0,
  ).length;
  const topRowSingleRightShare =
    topRowRightSlots.length === 1
      ? topRowRightSlots[0].cellIndices.length / columnCount
      : 0;
  const rowRightSlotCounts = rightSlotsByRow.map(({ length }) => length);
  const singleRightSlotRowCount = rowRightSlotCounts.filter((count) => count === 1).length;
  const dominantSingleRightRows = rightSlotsByRow.map((rowSlots) =>
    rowSlots.length === 1 &&
    rowSlots[0].cellIndices.length / columnCount >=
      policy.dominantSingleRightRowMinimumShare,
  );
  const columnsWithDownSlot = downSlotsByColumn.filter(({ length }) => length > 0).length;
  const clueCellCount = structuralReport.clueCellCount;
  const splitClueCellCount = structuralReport.splitClueCellCount;
  const directionCounts = { down: downSlots.length, right: rightSlots.length };
  const minorityDirectionShare =
    slots.length > 0 ? Math.min(downSlots.length, rightSlots.length) / slots.length : 0;
  const slotLengths = slots.map(({ cellIndices }) => cellIndices.length);
  const metrics = {
    clueCellCount,
    clueDensity: roundRatio(clueCellCount / (rowCount * columnCount)),
    columnDownCoverage: roundRatio(columnsWithDownSlot / columnCount),
    columnsWithDownSlot,
    directionCounts,
    distinctSlotLengths: [...new Set(slotLengths)].sort((left, right) => left - right),
    dominantSingleRightRowIndices: dominantSingleRightRows.flatMap((isDominant, rowIndex) =>
      isDominant ? [rowIndex] : [],
    ),
    maximumConsecutiveDominantSingleRightRows:
      longestConsecutiveRun(dominantSingleRightRows),
    maximumDownSlotLength: Math.max(...downSlots.map(({ cellIndices }) => cellIndices.length), 0),
    maximumRightSlotLength: Math.max(
      ...rightSlots.map(({ cellIndices }) => cellIndices.length),
      0,
    ),
    minorityDirectionShare: roundRatio(minorityDirectionShare),
    rowRightSlotCounts,
    singleRightSlotRowCount,
    singleRightSlotRowShare: roundRatio(singleRightSlotRowCount / rowCount),
    splitClueCellCount,
    splitClueShare: roundRatio(splitClueCellCount / clueCellCount),
    topRowDownStartCount,
    topRowRightSlotCount: topRowRightSlots.length,
    topRowRightSlotLengths: topRowRightSlots.map(({ cellIndices }) => cellIndices.length),
    topRowSingleRightShare: roundRatio(topRowSingleRightShare),
  };
  const issues = [];

  if (metrics.topRowSingleRightShare > policy.maximumTopRowSingleRightShare) {
    issues.push(
      `Top row has one right slot covering ${metrics.topRowSingleRightShare} of the row; ` +
        `${policy.maximumTopRowSingleRightShare} allowed.`,
    );
  }

  const requiredTopRowDownStarts = Math.min(
    policy.minimumTopRowDownStarts,
    Math.max(1, Math.floor(columnCount / 3)),
  );

  if (metrics.topRowDownStartCount < requiredTopRowDownStarts) {
    issues.push(
      `Top row starts ${metrics.topRowDownStartCount} down slot(s); ` +
        `${requiredTopRowDownStarts} required.`,
    );
  }

  if (metrics.singleRightSlotRowShare > policy.maximumSingleRightRowShare) {
    issues.push(
      `Single-right-slot row share ${metrics.singleRightSlotRowShare} exceeds ` +
        `${policy.maximumSingleRightRowShare}.`,
    );
  }

  if (
    metrics.maximumConsecutiveDominantSingleRightRows >
    policy.maximumConsecutiveDominantSingleRightRows
  ) {
    issues.push(
      `Grid has ${metrics.maximumConsecutiveDominantSingleRightRows} consecutive ` +
        `dominant single-right rows; ` +
        `${policy.maximumConsecutiveDominantSingleRightRows} allowed.`,
    );
  }

  if (metrics.columnDownCoverage < policy.minimumColumnDownCoverage) {
    issues.push(
      `Down-slot column coverage ${metrics.columnDownCoverage} is below ` +
        `${policy.minimumColumnDownCoverage}.`,
    );
  }

  if (metrics.minorityDirectionShare < policy.minimumDirectionShare) {
    issues.push(
      `Minority direction share ${metrics.minorityDirectionShare} is below ` +
        `${policy.minimumDirectionShare}.`,
    );
  }

  if (metrics.clueDensity < policy.minimumClueDensity) {
    issues.push(
      `Clue density ${metrics.clueDensity} is below ${policy.minimumClueDensity}.`,
    );
  } else if (metrics.clueDensity > policy.maximumClueDensity) {
    issues.push(
      `Clue density ${metrics.clueDensity} exceeds ${policy.maximumClueDensity}.`,
    );
  }

  if (metrics.splitClueShare < policy.minimumSplitClueShare) {
    issues.push(
      `Split-clue share ${metrics.splitClueShare} is below ${policy.minimumSplitClueShare}.`,
    );
  } else if (metrics.splitClueShare > policy.maximumSplitClueShare) {
    issues.push(
      `Split-clue share ${metrics.splitClueShare} exceeds ${policy.maximumSplitClueShare}.`,
    );
  }

  return {
    issues,
    metrics,
    passed: issues.length === 0,
    policy,
    score: scoreAestheticMetrics(metrics),
  };
}

module.exports = {
  DEFAULT_NEWSPAPER_AESTHETIC_POLICY,
  evaluateNewspaperTopologyAesthetics,
  resolveAestheticPolicy,
  scoreAestheticMetrics,
};
