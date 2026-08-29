const { createSeededRandom } = require('./clue-selection');
const { getNewspaperSlotArrow } = require('./newspaper-topology');

const DEFAULT_CANONICAL_LAYOUT_POLICY = Object.freeze({
  maximumBoundaryAnswerLength: 6,
  minimumBoundaryAnswerLength: 2,
  minimumInteriorStraightSplitCount: 2,
});

function createAlternatingBoundaryIndices(length) {
  return Array.from({ length: Math.ceil(length / 2) }, (_, index) => index * 2);
}

function arraysEqual(left, right) {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function getClueCellIndices(topology) {
  return topology.cells.flatMap((cell, cellIndex) =>
    cell.type === 'clue' ? [cellIndex] : [],
  );
}

function getSlotsByClueCell(topology) {
  return topology.slots.reduce((slotsByClueCell, slot) => {
    const clueSlots = slotsByClueCell.get(slot.clueCellIndex) ?? [];
    clueSlots.push(slot);
    slotsByClueCell.set(slot.clueCellIndex, clueSlots);
    return slotsByClueCell;
  }, new Map());
}

function findSlot(clueSlots, arrow) {
  return clueSlots.find((slot) => getNewspaperSlotArrow(slot) === arrow);
}

function resolveCanonicalLayoutPolicy(topology, overrides = {}) {
  const policy = {
    ...DEFAULT_CANONICAL_LAYOUT_POLICY,
    minimumInteriorStraightSplitCount: Math.max(
      DEFAULT_CANONICAL_LAYOUT_POLICY.minimumInteriorStraightSplitCount,
      Math.floor(Math.min(topology.rowCount, topology.columnCount) / 3),
    ),
    ...overrides,
  };

  for (const field of [
    'maximumBoundaryAnswerLength',
    'minimumBoundaryAnswerLength',
    'minimumInteriorStraightSplitCount',
  ]) {
    if (!Number.isInteger(policy[field]) || policy[field] < 0) {
      throw new Error(`${field} must be a non-negative integer.`);
    }
  }

  if (policy.minimumBoundaryAnswerLength < 2) {
    throw new Error('minimumBoundaryAnswerLength must be at least 2.');
  }

  if (
    policy.minimumBoundaryAnswerLength > policy.maximumBoundaryAnswerLength
  ) {
    throw new Error(
      'minimumBoundaryAnswerLength cannot exceed maximumBoundaryAnswerLength.',
    );
  }

  return policy;
}

function evaluateCanonicalNewspaperLayout(topology, policyOverrides) {
  const policy = resolveCanonicalLayoutPolicy(topology, policyOverrides);
  const { columnCount, rowCount } = topology;
  const clueCellIndices = getClueCellIndices(topology);
  const slotsByClueCell = getSlotsByClueCell(topology);
  const expectedTopClueColumns = createAlternatingBoundaryIndices(columnCount);
  const expectedLeftClueRows = createAlternatingBoundaryIndices(rowCount);
  const topClueColumns = clueCellIndices
    .filter((cellIndex) => Math.floor(cellIndex / columnCount) === 0)
    .map((cellIndex) => cellIndex % columnCount);
  const leftClueRows = clueCellIndices
    .filter((cellIndex) => cellIndex % columnCount === 0)
    .map((cellIndex) => Math.floor(cellIndex / columnCount));
  const boundarySlots = [];
  const issues = [];

  if (!arraysEqual(topClueColumns, expectedTopClueColumns)) {
    issues.push(
      `Top edge clue columns must be ${expectedTopClueColumns.join(', ')}; ` +
        `received ${topClueColumns.join(', ')}.`,
    );
  }

  if (!arraysEqual(leftClueRows, expectedLeftClueRows)) {
    issues.push(
      `Left edge clue rows must be ${expectedLeftClueRows.join(', ')}; ` +
        `received ${leftClueRows.join(', ')}.`,
    );
  }

  const topLeftSlots = slotsByClueCell.get(0) ?? [];
  const topLeftDownSlot = findSlot(topLeftSlots, 'right-down');
  const topLeftRightSlot = findSlot(topLeftSlots, 'down-right');

  if (topLeftSlots.length !== 2 || !topLeftDownSlot || !topLeftRightSlot) {
    issues.push(
      'Top-left clue cell must contain exactly a bent down clue and a bent right clue.',
    );
  } else {
    boundarySlots.push(topLeftDownSlot, topLeftRightSlot);
  }

  for (const columnIndex of expectedTopClueColumns.slice(1)) {
    const clueCellIndex = columnIndex;
    const clueSlots = slotsByClueCell.get(clueCellIndex) ?? [];
    const isTerminalClue = columnIndex === columnCount - 1;
    const requiredArrow = isTerminalClue ? 'down' : 'right-down';
    const requiredSlot = findSlot(clueSlots, requiredArrow);
    const allowedArrows = new Set(
      isTerminalClue ? ['down'] : ['down', 'right-down'],
    );

    if (!requiredSlot) {
      issues.push(
        `Top clue at column ${columnIndex} must start a ${requiredArrow} answer.`,
      );
    } else if (!isTerminalClue) {
      boundarySlots.push(requiredSlot);
    }

    if (
      clueSlots.length < 1 ||
      clueSlots.length > 2 ||
      clueSlots.some((slot) => !allowedArrows.has(getNewspaperSlotArrow(slot)))
    ) {
      issues.push(
        `Top clue at column ${columnIndex} contains a non-canonical arrow combination.`,
      );
    }
  }

  for (const rowIndex of expectedLeftClueRows.slice(1)) {
    const clueCellIndex = rowIndex * columnCount;
    const clueSlots = slotsByClueCell.get(clueCellIndex) ?? [];
    const isTerminalClue = rowIndex === rowCount - 1;
    const requiredArrow = isTerminalClue ? 'right' : 'down-right';
    const requiredSlot = findSlot(clueSlots, requiredArrow);
    const allowedArrows = new Set(
      isTerminalClue ? ['right'] : ['down-right', 'right'],
    );

    if (!requiredSlot) {
      issues.push(
        `Left clue at row ${rowIndex} must start a ${requiredArrow} answer.`,
      );
    } else if (!isTerminalClue) {
      boundarySlots.push(requiredSlot);
    }

    if (
      clueSlots.length < 1 ||
      clueSlots.length > 2 ||
      clueSlots.some((slot) => !allowedArrows.has(getNewspaperSlotArrow(slot)))
    ) {
      issues.push(
        `Left clue at row ${rowIndex} contains a non-canonical arrow combination.`,
      );
    }
  }

  const uniqueBoundarySlots = [...new Map(
    boundarySlots.map((slot) => [slot.id, slot]),
  ).values()];
  const invalidBoundaryLengths = uniqueBoundarySlots
    .filter(
      ({ cellIndices }) =>
        cellIndices.length < policy.minimumBoundaryAnswerLength ||
        cellIndices.length > policy.maximumBoundaryAnswerLength,
    )
    .map(({ cellIndices, id }) => ({ id, length: cellIndices.length }));

  if (invalidBoundaryLengths.length > 0) {
    issues.push(
      `Bent boundary answer lengths must stay between ` +
        `${policy.minimumBoundaryAnswerLength} and ` +
        `${policy.maximumBoundaryAnswerLength}: ` +
        invalidBoundaryLengths
          .map(({ id, length }) => `${id}=${length}`)
          .join(', '),
    );
  }

  const topRowRightSlotCount = topology.slots.filter(
    ({ cellIndices, direction }) =>
      direction === 'right' &&
      Math.floor(cellIndices[0] / columnCount) === 0,
  ).length;
  const leftColumnDownSlotCount = topology.slots.filter(
    ({ cellIndices, direction }) =>
      direction === 'down' && cellIndices[0] % columnCount === 0,
  ).length;

  if (topRowRightSlotCount > 0) {
    issues.push('The top row cannot contain a horizontal answer lane.');
  }

  if (leftColumnDownSlotCount > 0) {
    issues.push('The left column cannot contain a vertical answer lane.');
  }

  const interiorStraightSplitCount = [...slotsByClueCell.entries()].filter(
    ([clueCellIndex, clueSlots]) =>
      clueCellIndex >= columnCount &&
      clueCellIndex % columnCount > 0 &&
      clueSlots.length === 2 &&
      findSlot(clueSlots, 'right') &&
      findSlot(clueSlots, 'down'),
  ).length;

  if (
    interiorStraightSplitCount < policy.minimumInteriorStraightSplitCount
  ) {
    issues.push(
      `Interior straight split-clue count ${interiorStraightSplitCount} is below ` +
        `${policy.minimumInteriorStraightSplitCount}.`,
    );
  }

  return {
    issues,
    metrics: {
      bentBoundaryAnswerLengths: uniqueBoundarySlots.map(
        ({ cellIndices }) => cellIndices.length,
      ),
      expectedLeftClueRows,
      expectedTopClueColumns,
      interiorStraightSplitCount,
      leftClueRows,
      leftColumnDownSlotCount,
      topClueColumns,
      topRowRightSlotCount,
    },
    passed: issues.length === 0,
    policy,
  };
}

function randomInteger(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function addTerminator(
  grid,
  startRowIndex,
  startColumnIndex,
  direction,
  availableLength,
  random,
  policy,
) {
  const maximumLength = Math.min(
    policy.maximumBoundaryAnswerLength,
    availableLength,
  );

  if (maximumLength < policy.minimumBoundaryAnswerLength) {
    return;
  }

  const preferredMinimumLength =
    maximumLength >= 3 && random() >= 0.12
      ? Math.max(3, policy.minimumBoundaryAnswerLength)
      : policy.minimumBoundaryAnswerLength;
  const answerLength = randomInteger(
    random,
    preferredMinimumLength,
    maximumLength,
  );

  if (answerLength === availableLength) {
    return;
  }

  const rowIndex =
    startRowIndex + (direction === 'down' ? answerLength : 0);
  const columnIndex =
    startColumnIndex + (direction === 'right' ? answerLength : 0);
  grid[rowIndex][columnIndex] = '#';
}

function createCanonicalPatternSample(request, attemptIndex, options = {}) {
  const policy = resolveCanonicalLayoutPolicy(request, options.policy);
  const random = createSeededRandom(
    `${request.seed}:canonical-pattern:${attemptIndex}`,
  );
  const grid = Array.from({ length: request.rowCount }, () =>
    Array(request.columnCount).fill('.'),
  );
  const topClueColumns = createAlternatingBoundaryIndices(request.columnCount);
  const leftClueRows = createAlternatingBoundaryIndices(request.rowCount);

  for (const columnIndex of topClueColumns) {
    grid[0][columnIndex] = '#';
  }

  for (const rowIndex of leftClueRows) {
    grid[rowIndex][0] = '#';
  }

  for (const columnIndex of topClueColumns) {
    if (columnIndex < request.columnCount - 1) {
      addTerminator(
        grid,
        0,
        columnIndex + 1,
        'down',
        request.rowCount,
        random,
        policy,
      );
    }
  }

  for (const rowIndex of leftClueRows) {
    if (rowIndex < request.rowCount - 1) {
      addTerminator(
        grid,
        rowIndex + 1,
        0,
        'right',
        request.columnCount,
        random,
        policy,
      );
    }
  }

  const maximumExtraClueCount =
    options.maximumExtraClueCount ??
    Math.max(1, Math.floor((request.rowCount * request.columnCount) / 12));
  const extraClueCount = randomInteger(random, 0, maximumExtraClueCount);
  const interiorCellIndices = [];

  for (let rowIndex = 1; rowIndex < request.rowCount; rowIndex += 1) {
    for (
      let columnIndex = 1;
      columnIndex < request.columnCount;
      columnIndex += 1
    ) {
      if (grid[rowIndex][columnIndex] === '.') {
        interiorCellIndices.push(rowIndex * request.columnCount + columnIndex);
      }
    }
  }

  for (let index = interiorCellIndices.length - 1; index > 0; index -= 1) {
    const replacementIndex = Math.floor(random() * (index + 1));
    [interiorCellIndices[index], interiorCellIndices[replacementIndex]] = [
      interiorCellIndices[replacementIndex],
      interiorCellIndices[index],
    ];
  }

  for (const cellIndex of interiorCellIndices.slice(0, extraClueCount)) {
    const rowIndex = Math.floor(cellIndex / request.columnCount);
    const columnIndex = cellIndex % request.columnCount;
    grid[rowIndex][columnIndex] = '#';
  }

  return grid.map((row) => row.join(''));
}

module.exports = {
  DEFAULT_CANONICAL_LAYOUT_POLICY,
  createAlternatingBoundaryIndices,
  createCanonicalPatternSample,
  evaluateCanonicalNewspaperLayout,
  resolveCanonicalLayoutPolicy,
};
