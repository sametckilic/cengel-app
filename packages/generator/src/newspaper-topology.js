const TOPOLOGY_DIRECTIONS = new Set(['down', 'right']);
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

function createNewspaperTopology(id, pattern) {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('Topology id must be a non-empty string.');
  }

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

  const { clueCellIndices, slots } = createSlotsFromPattern(
    pattern,
    columnCount,
  );
  const cells = Array.from({ length: rowCount * columnCount }, (_, cellIndex) => ({
    type: clueCellIndices.has(cellIndex) ? 'clue' : 'letter',
  }));

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

    if (!TOPOLOGY_DIRECTIONS.has(slot.direction)) {
      throw new Error(`Slot "${slot.id}" has an unsupported direction.`);
    }

    if (cells[slot.clueCellIndex]?.type !== 'clue') {
      throw new Error(`Slot "${slot.id}" does not start next to a clue cell.`);
    }

    if (!Array.isArray(slot.cellIndices) || slot.cellIndices.length < 2) {
      throw new Error(`Slot "${slot.id}" must contain at least two letter cells.`);
    }

    const step = slot.direction === 'right' ? 1 : columnCount;
    const firstCellIndex = slot.cellIndices[0];
    const clueDirectionKey = `${slot.clueCellIndex}:${slot.direction}`;

    if (clueDirections.has(clueDirectionKey)) {
      throw new Error(`Topology contains duplicate clue direction ${clueDirectionKey}.`);
    }

    clueDirections.add(clueDirectionKey);

    if (firstCellIndex !== slot.clueCellIndex + step) {
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
    clueUses.push(slot.direction);
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
  createNewspaper9x10Topology,
  createNewspaperBeginner7x7Topology,
  createNewspaperMedium8x8Topology,
  createNewspaperLarge10x10Topology,
  createNewspaperLarge10x12Topology,
  createNewspaperTopology,
  createNewspaperTopologyById,
  createNewspaperPrototypeTopology,
  validateNewspaperTopology,
};
