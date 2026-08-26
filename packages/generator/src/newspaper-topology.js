const TOPOLOGY_DIRECTIONS = new Set(['down', 'right']);
const TOPOLOGY_ARROWS = new Set([
  'down',
  'down-right',
  'right',
  'right-down',
]);
const TOPOLOGY_CELL_TYPES = new Set(['clue', 'letter']);
const PROTOTYPE_PATTERN = [
  '##.....#',
  '.#...#..',
  '.##.....',
  '..#.....',
  '#.##...#',
  '.#......',
  '...#....',
  '#.......',
];
const WIDE_9X10_PATTERN = [
  '##.....#..',
  '.#...#...#',
  '.##.......',
  '..#.......',
  '#.##...#..',
  '.#.......#',
  '...#......',
  '#....#....',
  '#....#....',
];
const BEGINNER_7X7_PATTERN = [
  '##....#',
  '.##....',
  '..#....',
  '..##...',
  '.#.....',
  '...#...',
  '#......',
];
const MEDIUM_8X8_PATTERN = [
  '##......',
  '.#......',
  '..#.....',
  '...#....',
  '....#...',
  '#.......',
  '#.......',
  '#.......',
];
const LARGE_10X10_PATTERN = [
  '##..#..#..',
  '.#...#...#',
  '.##.......',
  '..#.......',
  '#.##...#..',
  '.#.......#',
  '...#......',
  '#....#....',
  '#....#....',
  '#....#....',
];
const LARGE_10X12_PATTERN = [
  '##..#..#..##',
  '.#...#...#..',
  '.##....#....',
  '..#.......#.',
  '#.##...#...#',
  '.#..#....#..',
  '...#......#.',
  '#....#.....#',
  '#....#......',
  '#....#......',
];

function createSlotsFromPattern(pattern, columnCount) {
  const clueCellIndices = new Set(
    pattern.flatMap((row, rowIndex) =>
      [...row].flatMap((cell, columnIndex) =>
        cell === '#' ? [rowIndex * columnCount + columnIndex] : [],
      ),
    ),
  );
  const slots = [];

  for (const clueCellIndex of clueCellIndices) {
    const clueRowIndex = Math.floor(clueCellIndex / columnCount);

    for (const direction of TOPOLOGY_DIRECTIONS) {
      const step = direction === 'right' ? 1 : columnCount;
      const cellIndices = [];
      let cellIndex = clueCellIndex + step;

      while (
        cellIndex < pattern.length * columnCount &&
        !clueCellIndices.has(cellIndex) &&
        (direction === 'down' || Math.floor(cellIndex / columnCount) === clueRowIndex)
      ) {
        cellIndices.push(cellIndex);
        cellIndex += step;
      }

      if (cellIndices.length >= 2) {
        slots.push({
          id: `cell-${clueCellIndex}-${direction}`,
          clueCellIndex,
          direction,
          cellIndices,
        });
      }
    }
  }

  return { clueCellIndices, slots };
}

function stablePatternRank(value) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createArrowwordRuns(pattern, rowCount, columnCount) {
  const isInside = (rowIndex, columnIndex) =>
    rowIndex >= 0 &&
    columnIndex >= 0 &&
    rowIndex < rowCount &&
    columnIndex < columnCount;
  const isClue = (rowIndex, columnIndex) =>
    isInside(rowIndex, columnIndex) && pattern[rowIndex][columnIndex] === '#';
  const isLetter = (rowIndex, columnIndex) =>
    isInside(rowIndex, columnIndex) && pattern[rowIndex][columnIndex] === '.';
  const runs = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      if (!isLetter(rowIndex, columnIndex)) {
        continue;
      }

      if (
        !isLetter(rowIndex, columnIndex - 1) &&
        isLetter(rowIndex, columnIndex + 1)
      ) {
        const cellIndices = [];

        for (
          let runColumnIndex = columnIndex;
          isLetter(rowIndex, runColumnIndex);
          runColumnIndex += 1
        ) {
          cellIndices.push(rowIndex * columnCount + runColumnIndex);
        }

        const sources = [];

        if (isClue(rowIndex, columnIndex - 1)) {
          sources.push({
            arrow: 'right',
            clueCellIndex: rowIndex * columnCount + columnIndex - 1,
          });
        }

        if (isClue(rowIndex - 1, columnIndex)) {
          sources.push({
            arrow: 'down-right',
            clueCellIndex: (rowIndex - 1) * columnCount + columnIndex,
          });
        }

        if (sources.length > 0) {
          runs.push({ cellIndices, direction: 'right', sources });
        }
      }

      if (
        !isLetter(rowIndex - 1, columnIndex) &&
        isLetter(rowIndex + 1, columnIndex)
      ) {
        const cellIndices = [];

        for (
          let runRowIndex = rowIndex;
          isLetter(runRowIndex, columnIndex);
          runRowIndex += 1
        ) {
          cellIndices.push(runRowIndex * columnCount + columnIndex);
        }

        const sources = [];

        if (isClue(rowIndex - 1, columnIndex)) {
          sources.push({
            arrow: 'down',
            clueCellIndex: (rowIndex - 1) * columnCount + columnIndex,
          });
        }

        if (isClue(rowIndex, columnIndex - 1)) {
          sources.push({
            arrow: 'right-down',
            clueCellIndex: rowIndex * columnCount + columnIndex - 1,
          });
        }

        if (sources.length > 0) {
          runs.push({ cellIndices, direction: 'down', sources });
        }
      }
    }
  }

  return runs;
}

function assignArrowwordRunSources(runs, clueCellIndices, seed) {
  const sourceCountByClueCell = new Map(
    clueCellIndices.map((clueCellIndex) => [clueCellIndex, 0]),
  );

  for (const run of runs) {
    for (const { clueCellIndex } of run.sources) {
      sourceCountByClueCell.set(
        clueCellIndex,
        (sourceCountByClueCell.get(clueCellIndex) ?? 0) + 1,
      );
    }
  }

  const orphanClueCellIndex = clueCellIndices.find(
    (clueCellIndex) => sourceCountByClueCell.get(clueCellIndex) === 0,
  );

  if (orphanClueCellIndex !== undefined) {
    throw new Error(`Arrowword pattern contains orphan clue cell ${orphanClueCellIndex}.`);
  }

  const runNodeOffset = 1;
  const clueNodeOffset = runNodeOffset + runs.length;
  const sinkNodeIndex = clueNodeOffset + clueCellIndices.length;
  const nodeCount = sinkNodeIndex + 1;
  const graph = Array.from({ length: nodeCount }, () => []);
  const clueNodeByCellIndex = new Map(
    clueCellIndices.map((clueCellIndex, clueIndex) => [
      clueCellIndex,
      clueNodeOffset + clueIndex,
    ]),
  );

  function addFlowEdge(from, to, capacity, cost, source) {
    const forward = {
      capacity,
      cost,
      reverseIndex: graph[to].length,
      source,
      to,
    };
    const reverse = {
      capacity: 0,
      cost: -cost,
      reverseIndex: graph[from].length,
      source: undefined,
      to: from,
    };

    graph[from].push(forward);
    graph[to].push(reverse);
  }

  runs.forEach((run, runIndex) => {
    const runNodeIndex = runNodeOffset + runIndex;
    addFlowEdge(0, runNodeIndex, 1, 0);

    for (const source of run.sources) {
      const bentArrowCost = source.arrow.includes('-') ? 0 : 1_000;
      const seededCost =
        stablePatternRank(
          `${seed}:source:${runIndex}:${source.clueCellIndex}:${source.arrow}`,
        ) % 997;

      addFlowEdge(
        runNodeIndex,
        clueNodeByCellIndex.get(source.clueCellIndex),
        1,
        bentArrowCost + seededCost,
        source,
      );
    }
  });

  for (const clueCellIndex of clueCellIndices) {
    const clueNodeIndex = clueNodeByCellIndex.get(clueCellIndex);
    addFlowEdge(clueNodeIndex, sinkNodeIndex, 1, 0);
    addFlowEdge(clueNodeIndex, sinkNodeIndex, 1, 1_000_000);
  }

  let flow = 0;

  while (flow < runs.length) {
    const distances = Array(nodeCount).fill(Number.POSITIVE_INFINITY);
    const inQueue = Array(nodeCount).fill(false);
    const previousEdges = Array(nodeCount);
    const queue = [0];
    distances[0] = 0;
    inQueue[0] = true;

    while (queue.length > 0) {
      const nodeIndex = queue.shift();
      inQueue[nodeIndex] = false;

      graph[nodeIndex].forEach((edge, edgeIndex) => {
        const nextDistance = distances[nodeIndex] + edge.cost;

        if (edge.capacity < 1 || nextDistance >= distances[edge.to]) {
          return;
        }

        distances[edge.to] = nextDistance;
        previousEdges[edge.to] = { edgeIndex, nodeIndex };

        if (!inQueue[edge.to]) {
          queue.push(edge.to);
          inQueue[edge.to] = true;
        }
      });
    }

    if (!previousEdges[sinkNodeIndex]) {
      break;
    }

    for (
      let nodeIndex = sinkNodeIndex;
      nodeIndex !== 0;
      nodeIndex = previousEdges[nodeIndex].nodeIndex
    ) {
      const { edgeIndex, nodeIndex: previousNodeIndex } =
        previousEdges[nodeIndex];
      const edge = graph[previousNodeIndex][edgeIndex];
      edge.capacity -= 1;
      graph[nodeIndex][edge.reverseIndex].capacity += 1;
    }

    flow += 1;
  }

  if (flow !== runs.length) {
    throw new Error(
      'Arrowword pattern cannot assign one or two word runs to every clue cell.',
    );
  }

  const assignedSources = runs.map((_, runIndex) =>
    graph[runNodeOffset + runIndex].find(
      (edge) => edge.source && edge.capacity === 0,
    )?.source,
  );
  const assignedUseCount = assignedSources.reduce((counts, source) => {
    if (source) {
      counts.set(
        source.clueCellIndex,
        (counts.get(source.clueCellIndex) ?? 0) + 1,
      );
    }

    return counts;
  }, new Map());

  if (
    assignedSources.some((source) => !source) ||
    clueCellIndices.some(
      (clueCellIndex) => !assignedUseCount.has(clueCellIndex),
    )
  ) {
    throw new Error(
      'Arrowword pattern cannot assign one or two word runs to every clue cell.',
    );
  }

  return assignedSources;
}

function getNewspaperSlotArrow(slot) {
  return slot.arrow ?? slot.direction;
}

function getArrowDirection(arrow) {
  return arrow === 'right' || arrow === 'down-right' ? 'right' : 'down';
}

function getArrowFirstCellIndex(clueCellIndex, arrow, columnCount) {
  return arrow === 'right' || arrow === 'right-down'
    ? clueCellIndex + 1
    : clueCellIndex + columnCount;
}

function createBentArrowTopology(topology) {
  validateNewspaperTopology(topology);
  const slotsByFirstCell = topology.slots.reduce((slotsByCell, slot) => {
    const firstCellIndex = slot.cellIndices[0];
    const slots = slotsByCell.get(firstCellIndex) ?? [];
    slots.push(slot);
    slotsByCell.set(firstCellIndex, slots);
    return slotsByCell;
  }, new Map());
  const replacements = new Map();

  for (const slots of slotsByFirstCell.values()) {
    const rightSlot = slots.find(
      (slot) =>
        slot.direction === 'right' && getNewspaperSlotArrow(slot) === 'right',
    );
    const downSlot = slots.find(
      (slot) =>
        slot.direction === 'down' && getNewspaperSlotArrow(slot) === 'down',
    );

    if (!rightSlot || !downSlot) {
      continue;
    }

    replacements.set(rightSlot.id, {
      arrow: 'down-right',
      clueCellIndex: downSlot.clueCellIndex,
    });
    replacements.set(downSlot.id, {
      arrow: 'right-down',
      clueCellIndex: rightSlot.clueCellIndex,
    });
  }

  const decoratedTopology = {
    ...topology,
    cells: topology.cells.map((cell) => ({ ...cell })),
    slots: topology.slots.map((slot) => ({
      ...slot,
      ...(replacements.get(slot.id) ?? {}),
      cellIndices: [...slot.cellIndices],
    })),
  };

  validateNewspaperTopology(decoratedTopology);
  return decoratedTopology;
}

function resolveNewspaperPattern(pattern) {
  if (
    !Array.isArray(pattern) ||
    pattern.length < 3 ||
    typeof pattern[0] !== 'string' ||
    pattern[0].length < 3
  ) {
    throw new Error('Topology pattern must contain at least three rows and columns.');
  }

  const rowCount = pattern.length;
  const columnCount = pattern[0].length;

  if (
    pattern.some(
      (row) =>
        typeof row !== 'string' ||
        row.length !== columnCount ||
        !/^[#.]+$/.test(row),
    )
  ) {
    throw new Error('Topology pattern rows must have equal width and contain only # or .');
  }

  const clueCellIndices = new Set(
    pattern.flatMap((row, rowIndex) =>
      [...row].flatMap((cell, columnIndex) =>
        cell === '#' ? [rowIndex * columnCount + columnIndex] : [],
      ),
    ),
  );
  const cells = Array.from({ length: rowCount * columnCount }, (_, cellIndex) => ({
    type: clueCellIndices.has(cellIndex) ? 'clue' : 'letter',
  }));

  return { cells, clueCellIndices, columnCount, rowCount };
}

function createNewspaperTopology(id, pattern) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Topology id must be a non-empty string.');
  }

  const { cells, clueCellIndices, columnCount, rowCount } =
    resolveNewspaperPattern(pattern);

  const { slots } = createSlotsFromPattern(pattern, columnCount);

  const topology = {
    id,
    rowCount,
    columnCount,
    cells,
    slots,
  };

  validateNewspaperTopology(topology);
  return topology;
}

function createNewspaperArrowwordTopology(id, pattern, seed = id) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Topology id must be a non-empty string.');
  }

  if (typeof seed !== 'string' || seed.trim().length === 0) {
    throw new Error('Arrowword topology seed must be a non-empty string.');
  }

  const { cells, clueCellIndices, columnCount, rowCount } =
    resolveNewspaperPattern(pattern);
  const runs = createArrowwordRuns(pattern, rowCount, columnCount);
  const sources = assignArrowwordRunSources(
    runs,
    [...clueCellIndices],
    seed,
  );
  const topology = {
    id,
    cells,
    columnCount,
    rowCount,
    slots: runs.map((run, runIndex) => ({
      id: `run-${run.cellIndices[0]}-${run.direction}-${runIndex}`,
      ...sources[runIndex],
      direction: run.direction,
      cellIndices: [...run.cellIndices],
    })),
  };

  validateNewspaperTopology(topology);
  return topology;
}

function createNewspaperPrototypeTopology() {
  return createNewspaperTopology('newspaper-8x8-v2', PROTOTYPE_PATTERN);
}

function createNewspaper9x10Topology() {
  return createNewspaperTopology('newspaper-9x10-v1', WIDE_9X10_PATTERN);
}

function createNewspaperBeginner7x7Topology() {
  return createNewspaperTopology('newspaper-beginner-7x7-v1', BEGINNER_7X7_PATTERN);
}

function createNewspaperMedium8x8Topology() {
  return createNewspaperTopology('newspaper-medium-8x8-v1', MEDIUM_8X8_PATTERN);
}

function createNewspaperLarge10x12Topology() {
  return createNewspaperTopology('newspaper-large-10x12-v1', LARGE_10X12_PATTERN);
}

function createNewspaperLarge10x10Topology() {
  return createNewspaperTopology('newspaper-large-10x10-v1', LARGE_10X10_PATTERN);
}

function createNewspaperTopologyById(topologyId) {
  const factories = {
    'newspaper-8x8-v2': createNewspaperPrototypeTopology,
    'newspaper-9x10-v1': createNewspaper9x10Topology,
    'newspaper-beginner-7x7-v1': createNewspaperBeginner7x7Topology,
    'newspaper-medium-8x8-v1': createNewspaperMedium8x8Topology,
    'newspaper-large-10x10-v1': createNewspaperLarge10x10Topology,
    'newspaper-large-10x12-v1': createNewspaperLarge10x12Topology,
  };
  const factory = factories[topologyId];

  if (!factory) {
    throw new Error(`Unsupported newspaper topology: ${topologyId}`);
  }

  return factory();
}

function validateNewspaperTopology(topology) {
  const rowCount = topology?.rowCount;
  const columnCount = topology?.columnCount;
  const cells = Array.isArray(topology?.cells) ? topology.cells : [];
  const slots = Array.isArray(topology?.slots) ? topology.slots : [];
  const expectedCellCount = rowCount * columnCount;

  if (!Number.isInteger(rowCount) || rowCount < 3) {
    throw new Error('Topology rowCount must be an integer greater than or equal to 3.');
  }

  if (!Number.isInteger(columnCount) || columnCount < 3) {
    throw new Error('Topology columnCount must be an integer greater than or equal to 3.');
  }

  if (cells.length !== expectedCellCount) {
    throw new Error(`Topology has ${cells.length} cells; ${expectedCellCount} expected.`);
  }

  if (cells.some(({ type }) => !TOPOLOGY_CELL_TYPES.has(type))) {
    throw new Error('Topology cells must contain only clue or letter cells.');
  }

  if (slots.length === 0) {
    throw new Error('Topology must contain at least one answer slot.');
  }

  const slotIds = new Set();
  const clueDirections = new Set();
  const usesByLetterCell = new Map();
  const usesByClueCell = new Map();

  for (const slot of slots) {
    if (typeof slot.id !== 'string' || slot.id.length === 0 || slotIds.has(slot.id)) {
      throw new Error(`Topology contains an invalid or duplicate slot id: ${slot.id}`);
    }

    slotIds.add(slot.id);

    const arrow = getNewspaperSlotArrow(slot);

    if (!TOPOLOGY_DIRECTIONS.has(slot.direction)) {
      throw new Error(`Slot "${slot.id}" has an unsupported direction.`);
    }

    if (!TOPOLOGY_ARROWS.has(arrow) || getArrowDirection(arrow) !== slot.direction) {
      throw new Error(`Slot "${slot.id}" has an unsupported clue arrow.`);
    }

    if (cells[slot.clueCellIndex]?.type !== 'clue') {
      throw new Error(`Slot "${slot.id}" does not start next to a clue cell.`);
    }

    if (!Array.isArray(slot.cellIndices) || slot.cellIndices.length < 2) {
      throw new Error(`Slot "${slot.id}" must contain at least two letter cells.`);
    }

    const step = slot.direction === 'right' ? 1 : columnCount;
    const firstCellIndex = slot.cellIndices[0];
    const clueDirectionKey = `${slot.clueCellIndex}:${arrow}`;

    if (clueDirections.has(clueDirectionKey)) {
      throw new Error(`Topology contains duplicate clue direction ${clueDirectionKey}.`);
    }

    clueDirections.add(clueDirectionKey);

    if (
      firstCellIndex !==
      getArrowFirstCellIndex(slot.clueCellIndex, arrow, columnCount)
    ) {
      throw new Error(`Slot "${slot.id}" is not adjacent to its clue cell.`);
    }

    for (const [letterIndex, cellIndex] of slot.cellIndices.entries()) {
      const isInBounds =
        Number.isInteger(cellIndex) && cellIndex >= 0 && cellIndex < expectedCellCount;
      const isContinuous =
        letterIndex === 0 || cellIndex === slot.cellIndices[letterIndex - 1] + step;
      const staysInRow =
        slot.direction !== 'right' ||
        Math.floor(cellIndex / columnCount) === Math.floor(firstCellIndex / columnCount);

      if (!isInBounds || !isContinuous || !staysInRow || cells[cellIndex]?.type !== 'letter') {
        throw new Error(`Slot "${slot.id}" contains an invalid letter path.`);
      }

      const uses = usesByLetterCell.get(cellIndex) ?? [];

      if (uses.some(({ direction }) => direction === slot.direction)) {
        throw new Error(`Letter cell ${cellIndex} is reused in the same direction.`);
      }

      uses.push({ direction: slot.direction, slotId: slot.id });
      usesByLetterCell.set(cellIndex, uses);
    }

    const clueUses = usesByClueCell.get(slot.clueCellIndex) ?? [];

    if (clueUses.length >= 2) {
      throw new Error(
        `Clue cell ${slot.clueCellIndex} cannot contain more than two clues.`,
      );
    }

    clueUses.push(arrow);
    usesByClueCell.set(slot.clueCellIndex, clueUses);
  }

  const orphanLetterIndices = cells.flatMap((cell, cellIndex) =>
    cell.type === 'letter' && !usesByLetterCell.has(cellIndex) ? [cellIndex] : [],
  );
  const orphanClueIndices = cells.flatMap((cell, cellIndex) =>
    cell.type === 'clue' && !usesByClueCell.has(cellIndex) ? [cellIndex] : [],
  );

  if (orphanLetterIndices.length > 0) {
    throw new Error(`Topology contains ${orphanLetterIndices.length} orphan letter cell(s).`);
  }

  if (orphanClueIndices.length > 0) {
    throw new Error(`Topology contains ${orphanClueIndices.length} orphan clue cell(s).`);
  }

  return {
    clueCellCount: usesByClueCell.size,
    intersectionCellCount: [...usesByLetterCell.values()].filter((uses) => uses.length > 1)
      .length,
    letterCellCount: usesByLetterCell.size,
    slotCount: slots.length,
    splitClueCellCount: [...usesByClueCell.values()].filter((directions) => directions.length > 1)
      .length,
  };
}

module.exports = {
  createBentArrowTopology,
  createNewspaperArrowwordTopology,
  createNewspaper9x10Topology,
  createNewspaperBeginner7x7Topology,
  createNewspaperMedium8x8Topology,
  createNewspaperLarge10x10Topology,
  createNewspaperLarge10x12Topology,
  createNewspaperTopology,
  createNewspaperTopologyById,
  createNewspaperPrototypeTopology,
  getNewspaperSlotArrow,
  validateNewspaperTopology,
};
