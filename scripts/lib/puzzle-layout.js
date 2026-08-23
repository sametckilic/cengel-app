const DIRECTIONS = ['right', 'down'];

function directionVector(direction) {
  return direction === 'right' ? { column: 1, row: 0 } : { column: 0, row: 1 };
}

function isInside(row, column, request) {
  return (
    row >= 0 &&
    row < request.rowCount &&
    column >= 0 &&
    column < request.columnCount
  );
}

function cellIndex(row, column, columnCount) {
  return row * columnCount + column;
}

function placementKey(placement) {
  return [
    placement.entry.id,
    placement.direction,
    placement.clueRow,
    placement.clueColumn,
  ].join(':');
}

function createPlacement(entry, direction, clueRow, clueColumn) {
  const vector = directionVector(direction);
  const startRow = clueRow + vector.row;
  const startColumn = clueColumn + vector.column;
  const coordinates = Array.from({ length: entry.answerLength }, (_, letterIndex) => ({
    character: entry.answer[letterIndex],
    column: startColumn + vector.column * letterIndex,
    row: startRow + vector.row * letterIndex,
  }));

  return {
    clueColumn,
    clueRow,
    coordinates,
    direction,
    entry,
  };
}

function getCell(grid, row, column, request) {
  if (!isInside(row, column, request)) {
    return undefined;
  }

  return grid[cellIndex(row, column, request.columnCount)];
}

function hasPerpendicularLetterNeighbor(grid, coordinate, direction, request) {
  const neighbors =
    direction === 'right'
      ? [
          { row: coordinate.row - 1, column: coordinate.column },
          { row: coordinate.row + 1, column: coordinate.column },
        ]
      : [
          { row: coordinate.row, column: coordinate.column - 1 },
          { row: coordinate.row, column: coordinate.column + 1 },
        ];

  return neighbors.some(({ row, column }) => getCell(grid, row, column, request)?.type === 'letter');
}

function evaluatePlacement(grid, placement, request, requireIntersection) {
  const clueCell = getCell(grid, placement.clueRow, placement.clueColumn, request);

  if (clueCell !== null) {
    return undefined;
  }

  let intersectionCount = 0;

  for (const coordinate of placement.coordinates) {
    if (!isInside(coordinate.row, coordinate.column, request)) {
      return undefined;
    }

    const existingCell = getCell(grid, coordinate.row, coordinate.column, request);

    if (existingCell === null) {
      if (hasPerpendicularLetterNeighbor(grid, coordinate, placement.direction, request)) {
        return undefined;
      }

      continue;
    }

    if (
      existingCell.type !== 'letter' ||
      existingCell.character !== coordinate.character ||
      existingCell.directions.has(placement.direction)
    ) {
      return undefined;
    }

    intersectionCount += 1;
  }

  if (requireIntersection && intersectionCount === 0) {
    return undefined;
  }

  const vector = directionVector(placement.direction);
  const lastCoordinate = placement.coordinates[placement.coordinates.length - 1];
  const cellAfterAnswer = getCell(
    grid,
    lastCoordinate.row + vector.row,
    lastCoordinate.column + vector.column,
    request,
  );

  if (cellAfterAnswer?.type === 'letter') {
    return undefined;
  }

  const middleCoordinate = placement.coordinates[Math.floor(placement.coordinates.length / 2)];
  const rowCenter = (request.rowCount - 1) / 2;
  const columnCenter = (request.columnCount - 1) / 2;
  const centerDistance =
    Math.abs(middleCoordinate.row - rowCenter) +
    Math.abs(middleCoordinate.column - columnCenter);
  const score =
    intersectionCount * 100_000 +
    placement.entry.answerLength * 100 -
    Math.round(centerDistance * 100);

  return { ...placement, intersectionCount, score };
}

function comparePlacements(left, right) {
  return right.score - left.score || placementKey(left).localeCompare(placementKey(right));
}

function isThemedEntry(entry, request) {
  return request.categories.includes(entry.category);
}

function countThemedWords(words, request) {
  return words.filter(({ category }) => request.categories.includes(category)).length;
}

function findInitialPlacements(grid, entry, request) {
  const placements = [];

  for (const direction of DIRECTIONS) {
    for (let row = 0; row < request.rowCount; row += 1) {
      for (let column = 0; column < request.columnCount; column += 1) {
        const placement = createPlacement(entry, direction, row, column);
        const evaluated = evaluatePlacement(grid, placement, request, false);

        if (evaluated) {
          placements.push(evaluated);
        }
      }
    }
  }

  return placements.sort(comparePlacements);
}

function findCrossingPlacements(grid, entry, request) {
  const placements = new Map();

  for (const direction of DIRECTIONS) {
    const vector = directionVector(direction);

    for (let letterIndex = 0; letterIndex < entry.answerLength; letterIndex += 1) {
      const character = entry.answer[letterIndex];

      for (let row = 0; row < request.rowCount; row += 1) {
        for (let column = 0; column < request.columnCount; column += 1) {
          const existingCell = getCell(grid, row, column, request);

          if (
            existingCell?.type !== 'letter' ||
            existingCell.character !== character ||
            existingCell.directions.has(direction)
          ) {
            continue;
          }

          const startRow = row - vector.row * letterIndex;
          const startColumn = column - vector.column * letterIndex;
          const clueRow = startRow - vector.row;
          const clueColumn = startColumn - vector.column;

          if (!isInside(clueRow, clueColumn, request)) {
            continue;
          }

          const placement = createPlacement(entry, direction, clueRow, clueColumn);
          const evaluated = evaluatePlacement(grid, placement, request, true);

          if (evaluated) {
            placements.set(placementKey(evaluated), evaluated);
          }
        }
      }
    }
  }

  return [...placements.values()].sort(comparePlacements);
}

function placeWord(state, placement, request) {
  const clueIndex = cellIndex(placement.clueRow, placement.clueColumn, request.columnCount);
  state.grid[clueIndex] = {
    direction: placement.direction,
    label: placement.entry.shortClue,
    type: 'clue',
  };

  const wordCellIndices = [];

  for (const coordinate of placement.coordinates) {
    const index = cellIndex(coordinate.row, coordinate.column, request.columnCount);
    const existingCell = state.grid[index];

    if (existingCell?.type === 'letter') {
      existingCell.directions.add(placement.direction);
    } else {
      state.grid[index] = {
        character: coordinate.character,
        directions: new Set([placement.direction]),
        type: 'letter',
      };
    }

    wordCellIndices.push(index);
  }

  state.intersectionCount += placement.intersectionCount;
  state.words.push({
    id: placement.entry.id,
    answer: placement.entry.answer,
    cellIndices: wordCellIndices,
    clue: placement.entry.shortClue,
    category: placement.entry.category,
    direction: placement.direction,
  });
}

function buildAttempt(entries, request, firstEntryIndex) {
  const state = {
    grid: Array.from({ length: request.rowCount * request.columnCount }, () => null),
    intersectionCount: 0,
    words: [],
  };
  const firstEntry = entries[firstEntryIndex];
  const firstPlacement = findInitialPlacements(state.grid, firstEntry, request)[0];

  if (!firstPlacement) {
    return state;
  }

  placeWord(state, firstPlacement, request);

  const remainingEntries = entries.filter((_, entryIndex) => entryIndex !== firstEntryIndex);

  while (state.words.length < request.targetWordCount && remainingEntries.length > 0) {
    let bestOption;
    const themedTarget = Math.ceil(request.targetWordCount * request.categoryWeight);
    const needsThemedWord = countThemedWords(state.words, request) < themedTarget;

    for (let entryIndex = 0; entryIndex < remainingEntries.length; entryIndex += 1) {
      const entry = remainingEntries[entryIndex];
      const placement = findCrossingPlacements(state.grid, entry, request)[0];

      const shouldPreferEntry =
        placement &&
        bestOption &&
        needsThemedWord &&
        isThemedEntry(entry, request) !== isThemedEntry(bestOption.entry, request)
          ? isThemedEntry(entry, request)
          : undefined;

      if (
        placement &&
        (!bestOption ||
          shouldPreferEntry === true ||
          (shouldPreferEntry === undefined &&
            comparePlacements(placement, bestOption.placement) < 0))
      ) {
        bestOption = { entry, entryIndex, placement };
      }
    }

    if (!bestOption) {
      break;
    }

    placeWord(state, bestOption.placement, request);
    remainingEntries.splice(bestOption.entryIndex, 1);
  }

  return state;
}

function compareAttempts(left, right, request) {
  const themedTarget = Math.ceil(request.targetWordCount * request.categoryWeight);
  const leftThemedDistance = Math.abs(countThemedWords(left.words, request) - themedTarget);
  const rightThemedDistance = Math.abs(countThemedWords(right.words, request) - themedTarget);

  return (
    right.words.length - left.words.length ||
    leftThemedDistance - rightThemedDistance ||
    right.intersectionCount - left.intersectionCount ||
    left.firstEntryIndex - right.firstEntryIndex
  );
}

function serializeLayout(state, request) {
  return {
    rowCount: request.rowCount,
    columnCount: request.columnCount,
    intersectionCount: state.intersectionCount,
    cells: state.grid.map((cell) => {
      if (cell === null) {
        return { type: 'void' };
      }

      if (cell.type === 'clue') {
        return {
          type: 'clue',
          label: cell.label,
          direction: cell.direction,
        };
      }

      return { type: 'letter' };
    }),
    words: state.words,
  };
}

function generatePuzzleLayout(entries, request) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('At least one clue candidate is required.');
  }

  if (!Number.isInteger(request.targetWordCount) || request.targetWordCount < 1) {
    throw new Error('targetWordCount must be a positive integer.');
  }

  if (request.targetWordCount > entries.length) {
    throw new Error(
      `targetWordCount (${request.targetWordCount}) exceeds candidate count (${entries.length}).`,
    );
  }

  const attemptCount = Math.min(entries.length, 64);
  const attempts = Array.from({ length: attemptCount }, (_, firstEntryIndex) => ({
    ...buildAttempt(entries, request, firstEntryIndex),
    firstEntryIndex,
  })).sort((left, right) => compareAttempts(left, right, request));
  const bestAttempt = attempts[0];

  if (bestAttempt.words.length < request.targetWordCount) {
    throw new Error(
      `Could place only ${bestAttempt.words.length} of ${request.targetWordCount} requested words ` +
        `in a ${request.rowCount}x${request.columnCount} grid.`,
    );
  }

  return serializeLayout(bestAttempt, request);
}

module.exports = {
  generatePuzzleLayout,
};
