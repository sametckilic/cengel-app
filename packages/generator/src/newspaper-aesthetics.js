const {
  getNewspaperSlotArrow,
  validateNewspaperTopology,
} = require('./newspaper-topology');

const DEFAULT_NEWSPAPER_AESTHETIC_POLICY = Object.freeze({
  dominantSingleRightRowMinimumShare: 0.6,
  maximumClueDensity: 0.36,
  maximumConsecutiveDominantSingleRightRows: 6,
  maximumLeadingEdgeClueShare: 0.75,
  maximumSingleRightRowShare: 0.9,
  maximumSplitClueShare: 0.65,
  maximumTopRowRightSlotCount: 1,
  maximumTopRowSingleRightShare: 0.5,
  minimumBentArrowShare: 0.1,
  minimumClueColumnCoverage: 0.5,
  minimumClueDensity: 0.14,
  minimumClueRowCoverage: 0.5,
  minimumColumnDownCoverage: 0.7,
  minimumDirectionShare: 0.35,
  minimumInteriorClueShare: 0.3,
  minimumInteriorStraightSplitCount: 2,
  minimumIndependentBentArrowCount: 1,
  minimumLeftEdgeBentRightCount: 3,
  minimumLeftEdgeScaffoldSpan: 0.6,
  minimumSplitClueShare: 0.1,
  minimumTopEdgeBentDownCount: 3,
  minimumTopEdgeScaffoldSpan: 0.55,
  minimumTopRowDownStarts: 2,
  requireTopLeftScaffoldPair: true,
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
    'maximumLeadingEdgeClueShare',
    'maximumSingleRightRowShare',
    'maximumSplitClueShare',
    'maximumTopRowSingleRightShare',
    'minimumBentArrowShare',
    'minimumClueColumnCoverage',
    'minimumClueDensity',
    'minimumClueRowCoverage',
    'minimumColumnDownCoverage',
    'minimumDirectionShare',
    'minimumInteriorClueShare',
    'minimumLeftEdgeScaffoldSpan',
    'minimumSplitClueShare',
    'minimumTopEdgeScaffoldSpan',
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

  if (
    !Number.isInteger(policy.minimumIndependentBentArrowCount) ||
    policy.minimumIndependentBentArrowCount < 0
  ) {
    throw new Error('minimumIndependentBentArrowCount must be a non-negative integer.');
  }

  for (const field of [
    'maximumTopRowRightSlotCount',
    'minimumInteriorStraightSplitCount',
    'minimumLeftEdgeBentRightCount',
    'minimumTopEdgeBentDownCount',
  ]) {
    if (!Number.isInteger(policy[field]) || policy[field] < 0) {
      throw new Error(`${field} must be a non-negative integer.`);
    }
  }

  if (typeof policy.requireTopLeftScaffoldPair !== 'boolean') {
    throw new Error('requireTopLeftScaffoldPair must be a boolean.');
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
  const boundaryScaffoldFit =
    (Math.min(metrics.topEdgeBentDownCount / 3, 1) +
      Math.min(metrics.leftEdgeBentRightCount / 3, 1) +
      metrics.topEdgeScaffoldSpan +
      metrics.leftEdgeScaffoldSpan) /
    4;
  const slotLengthVariety = Math.min(metrics.distinctSlotLengths.length / 6, 1);
  const bentArrowVariety = Math.min(metrics.bentArrowShare / 0.25, 1);
  const score =
    metrics.columnDownCoverage * 12 +
    directionBalance * 12 +
    clueDensityFit * 12 +
    splitClueFit * 8 +
    boundaryScaffoldFit * 12 +
    slotLengthVariety * 6 +
    metrics.clueRowCoverage * 12 +
    metrics.clueColumnCoverage * 10 +
    metrics.interiorClueShare * 6 +
    Math.min(metrics.interiorStraightSplitCount / 4, 1) * 4 +
    bentArrowVariety * 10;

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
      rightSlotsByRow[Math.floor(slot.cellIndices[0] / columnCount)].push(slot);
    } else {
      downSlotsByColumn[slot.cellIndices[0] % columnCount].push(slot);
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
  const clueCellIndices = topology.cells.flatMap((cell, cellIndex) =>
    cell.type === 'clue' ? [cellIndex] : [],
  );
  const clueRowIndices = new Set(
    clueCellIndices.map((cellIndex) => Math.floor(cellIndex / columnCount)),
  );
  const clueColumnIndices = new Set(
    clueCellIndices.map((cellIndex) => cellIndex % columnCount),
  );
  const interiorClueCount = clueCellIndices.filter((cellIndex) => {
    const rowIndex = Math.floor(cellIndex / columnCount);
    const columnIndex = cellIndex % columnCount;

    return rowIndex > 0 && columnIndex > 0;
  }).length;
  const leadingEdgeClueCount = clueCellIndices.filter((cellIndex) => {
    const rowIndex = Math.floor(cellIndex / columnCount);
    const columnIndex = cellIndex % columnCount;

    return rowIndex === 0 || columnIndex === 0;
  }).length;
  const bentArrowCount = slots.filter(
    ({ arrow, direction }) => arrow !== undefined && arrow !== direction,
  ).length;
  const slotStartUseCount = slots.reduce((counts, { cellIndices }) => {
    const firstCellIndex = cellIndices[0];
    counts.set(firstCellIndex, (counts.get(firstCellIndex) ?? 0) + 1);
    return counts;
  }, new Map());
  const independentBentArrowCount = slots.filter(
    ({ arrow, cellIndices, direction }) =>
      arrow !== undefined &&
      arrow !== direction &&
      slotStartUseCount.get(cellIndices[0]) === 1,
  ).length;
  const topEdgeBentDownSlots = slots.filter(
    (slot) =>
      Math.floor(slot.clueCellIndex / columnCount) === 0 &&
      slot.direction === 'down' &&
      getNewspaperSlotArrow(slot) === 'right-down' &&
      slot.cellIndices[0] === slot.clueCellIndex + 1,
  );
  const leftEdgeBentRightSlots = slots.filter(
    (slot) =>
      slot.clueCellIndex % columnCount === 0 &&
      slot.direction === 'right' &&
      getNewspaperSlotArrow(slot) === 'down-right' &&
      slot.cellIndices[0] === slot.clueCellIndex + columnCount,
  );
  const slotsByClueCell = slots.reduce((slotsByCell, slot) => {
    const clueSlots = slotsByCell.get(slot.clueCellIndex) ?? [];
    clueSlots.push(slot);
    slotsByCell.set(slot.clueCellIndex, clueSlots);
    return slotsByCell;
  }, new Map());
  const topLeftSlots = slotsByClueCell.get(0) ?? [];
  const hasTopLeftScaffoldPair =
    topLeftSlots.length === 2 &&
    topLeftSlots.some(
      (slot) =>
        slot.direction === 'down' &&
        getNewspaperSlotArrow(slot) === 'right-down' &&
        slot.cellIndices[0] === 1,
    ) &&
    topLeftSlots.some(
      (slot) =>
        slot.direction === 'right' &&
        getNewspaperSlotArrow(slot) === 'down-right' &&
        slot.cellIndices[0] === columnCount,
    );
  const interiorStraightSplitCount = [...slotsByClueCell.entries()].filter(
    ([clueCellIndex, clueSlots]) =>
      clueCellIndex >= columnCount &&
      clueCellIndex % columnCount > 0 &&
      clueSlots.length === 2 &&
      clueSlots.some(
        (slot) =>
          slot.direction === 'right' && getNewspaperSlotArrow(slot) === 'right',
      ) &&
      clueSlots.some(
        (slot) =>
          slot.direction === 'down' && getNewspaperSlotArrow(slot) === 'down',
      ),
  ).length;
  const topEdgeScaffoldSpan =
    topEdgeBentDownSlots.length > 0
      ? Math.max(...topEdgeBentDownSlots.map(({ clueCellIndex }) => clueCellIndex)) /
        (columnCount - 1)
      : 0;
  const leftEdgeScaffoldSpan =
    leftEdgeBentRightSlots.length > 0
      ? Math.max(
          ...leftEdgeBentRightSlots.map(({ clueCellIndex }) =>
            Math.floor(clueCellIndex / columnCount),
          ),
        ) /
        (rowCount - 1)
      : 0;
  const metrics = {
    bentArrowCount,
    bentArrowShare: roundRatio(bentArrowCount / slots.length),
    clueCellCount,
    clueColumnCoverage: roundRatio(clueColumnIndices.size / columnCount),
    clueDensity: roundRatio(clueCellCount / (rowCount * columnCount)),
    clueRowCoverage: roundRatio(clueRowIndices.size / rowCount),
    columnDownCoverage: roundRatio(columnsWithDownSlot / columnCount),
    columnsWithDownSlot,
    directionCounts,
    distinctSlotLengths: [...new Set(slotLengths)].sort((left, right) => left - right),
    dominantSingleRightRowIndices: dominantSingleRightRows.flatMap((isDominant, rowIndex) =>
      isDominant ? [rowIndex] : [],
    ),
    independentBentArrowCount,
    hasTopLeftScaffoldPair,
    interiorStraightSplitCount,
    leftEdgeBentRightCount: leftEdgeBentRightSlots.length,
    leftEdgeScaffoldSpan: roundRatio(leftEdgeScaffoldSpan),
    maximumConsecutiveDominantSingleRightRows:
      longestConsecutiveRun(dominantSingleRightRows),
    interiorClueCount,
    interiorClueShare: roundRatio(interiorClueCount / clueCellCount),
    leadingEdgeClueCount,
    leadingEdgeClueShare: roundRatio(leadingEdgeClueCount / clueCellCount),
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
    topEdgeBentDownCount: topEdgeBentDownSlots.length,
    topEdgeScaffoldSpan: roundRatio(topEdgeScaffoldSpan),
    topRowRightSlotCount: topRowRightSlots.length,
    topRowRightSlotLengths: topRowRightSlots.map(({ cellIndices }) => cellIndices.length),
    topRowSingleRightShare: roundRatio(topRowSingleRightShare),
  };
  const issues = [];

  if (
    policy.requireTopLeftScaffoldPair &&
    !metrics.hasTopLeftScaffoldPair
  ) {
    issues.push(
      'Top-left clue cell must start a bent down answer and a bent right answer.',
    );
  }

  if (metrics.topEdgeBentDownCount < policy.minimumTopEdgeBentDownCount) {
    issues.push(
      `Top edge starts ${metrics.topEdgeBentDownCount} bent down answer(s); ` +
        `${policy.minimumTopEdgeBentDownCount} required.`,
    );
  }

  if (metrics.leftEdgeBentRightCount < policy.minimumLeftEdgeBentRightCount) {
    issues.push(
      `Left edge starts ${metrics.leftEdgeBentRightCount} bent right answer(s); ` +
        `${policy.minimumLeftEdgeBentRightCount} required.`,
    );
  }

  if (metrics.topEdgeScaffoldSpan < policy.minimumTopEdgeScaffoldSpan) {
    issues.push(
      `Top-edge scaffold span ${metrics.topEdgeScaffoldSpan} is below ` +
        `${policy.minimumTopEdgeScaffoldSpan}.`,
    );
  }

  if (metrics.leftEdgeScaffoldSpan < policy.minimumLeftEdgeScaffoldSpan) {
    issues.push(
      `Left-edge scaffold span ${metrics.leftEdgeScaffoldSpan} is below ` +
        `${policy.minimumLeftEdgeScaffoldSpan}.`,
    );
  }

  if (
    metrics.interiorStraightSplitCount <
    policy.minimumInteriorStraightSplitCount
  ) {
    issues.push(
      `Interior straight split count ${metrics.interiorStraightSplitCount} is below ` +
        `${policy.minimumInteriorStraightSplitCount}.`,
    );
  }

  if (metrics.topRowRightSlotCount > policy.maximumTopRowRightSlotCount) {
    issues.push(
      `Top row contains ${metrics.topRowRightSlotCount} right answer(s); ` +
        `${policy.maximumTopRowRightSlotCount} allowed.`,
    );
  }

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

  if (metrics.bentArrowShare < policy.minimumBentArrowShare) {
    issues.push(
      `Bent-arrow share ${metrics.bentArrowShare} is below ` +
        `${policy.minimumBentArrowShare}.`,
    );
  }

  if (
    metrics.independentBentArrowCount <
    policy.minimumIndependentBentArrowCount
  ) {
    issues.push(
      `Independent bent-arrow count ${metrics.independentBentArrowCount} is below ` +
        `${policy.minimumIndependentBentArrowCount}.`,
    );
  }

  if (metrics.clueRowCoverage < policy.minimumClueRowCoverage) {
    issues.push(
      `Clue-row coverage ${metrics.clueRowCoverage} is below ` +
        `${policy.minimumClueRowCoverage}.`,
    );
  }

  if (metrics.clueColumnCoverage < policy.minimumClueColumnCoverage) {
    issues.push(
      `Clue-column coverage ${metrics.clueColumnCoverage} is below ` +
        `${policy.minimumClueColumnCoverage}.`,
    );
  }

  if (metrics.interiorClueShare < policy.minimumInteriorClueShare) {
    issues.push(
      `Interior-clue share ${metrics.interiorClueShare} is below ` +
        `${policy.minimumInteriorClueShare}.`,
    );
  }

  if (metrics.leadingEdgeClueShare > policy.maximumLeadingEdgeClueShare) {
    issues.push(
      `Leading-edge clue share ${metrics.leadingEdgeClueShare} exceeds ` +
        `${policy.maximumLeadingEdgeClueShare}.`,
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
