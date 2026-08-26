const NEWSPAPER_DIRECTIONS = new Set(['down', 'right']);
const NEWSPAPER_ARROWS = new Set([
  'down',
  'down-right',
  'right',
  'right-down',
]);
const NEWSPAPER_CELL_TYPES = new Set(['clue', 'letter', 'split-clue']);

function getCellClues(cell) {
  if (cell?.type === 'clue') {
    return [
      {
        ...(cell.arrow === undefined ? {} : { arrow: cell.arrow }),
        direction: cell.direction,
        label: cell.label,
      },
    ];
  }

  if (cell?.type === 'split-clue' && Array.isArray(cell.clues)) {
    return cell.clues;
  }

  return [];
}

function getWordStep(direction, columnCount) {
  return direction === 'right' ? 1 : columnCount;
}

function getClueArrow(clue) {
  return clue?.arrow ?? clue?.direction;
}

function getArrowDirection(arrow) {
  return arrow === 'right' || arrow === 'down-right' ? 'right' : 'down';
}

function getArrowFirstCellIndex(clueCellIndex, arrow, columnCount) {
  return arrow === 'right' || arrow === 'right-down'
    ? clueCellIndex + 1
    : clueCellIndex + columnCount;
}

function getClueKey(cellIndex, arrow) {
  return `${cellIndex}:${arrow}`;
}

function roundRatio(value) {
  return Number(value.toFixed(4));
}

function analyzeNewspaperPuzzle(puzzle) {
  const rowCount = Number.isInteger(puzzle?.rowCount) ? puzzle.rowCount : 0;
  const columnCount = Number.isInteger(puzzle?.columnCount) ? puzzle.columnCount : 0;
  const expectedCellCount = rowCount * columnCount;
  const cells = Array.isArray(puzzle?.cells) ? puzzle.cells : [];
  const words = Array.isArray(puzzle?.words) ? puzzle.words : [];
  const issues = [];
  const cellTypeCounts = {
    clue: 0,
    letter: 0,
    'split-clue': 0,
    unknown: 0,
    void: 0,
  };

  if (rowCount < 1 || columnCount < 1) {
    issues.push('Grid dimensions must be positive integers.');
  }

  if (cells.length !== expectedCellCount) {
    issues.push(`Grid has ${cells.length} cells; ${expectedCellCount} expected.`);
  }

  const clueByKey = new Map();
  const duplicateClueKeys = new Set();

  cells.forEach((cell, cellIndex) => {
    if (cell?.type === 'void') {
      cellTypeCounts.void += 1;
      return;
    }

    if (!NEWSPAPER_CELL_TYPES.has(cell?.type)) {
      cellTypeCounts.unknown += 1;
      return;
    }

    cellTypeCounts[cell.type] += 1;

    for (const clue of getCellClues(cell)) {
      const arrow = getClueArrow(clue);

      if (
        !NEWSPAPER_DIRECTIONS.has(clue?.direction) ||
        !NEWSPAPER_ARROWS.has(arrow) ||
        getArrowDirection(arrow) !== clue?.direction ||
        typeof clue?.label !== 'string' ||
        clue.label.trim().length === 0
      ) {
        issues.push(`Clue cell ${cellIndex} contains an invalid clue.`);
        continue;
      }

      const clueKey = getClueKey(cellIndex, arrow);

      if (clueByKey.has(clueKey)) {
        duplicateClueKeys.add(clueKey);
      } else {
        clueByKey.set(clueKey, clue);
      }
    }
  });

  if (cellTypeCounts.void > 0) {
    issues.push(`Grid contains ${cellTypeCounts.void} void cell(s).`);
  }

  if (cellTypeCounts.unknown > 0) {
    issues.push(`Grid contains ${cellTypeCounts.unknown} unsupported cell(s).`);
  }

  if (duplicateClueKeys.size > 0) {
    issues.push(`Grid contains ${duplicateClueKeys.size} duplicate clue direction(s).`);
  }

  const usedClueKeys = new Set();
  const letterUseByCell = new Map();
  const characterByCell = new Map();
  const conflictingCellIndices = new Set();
  const invalidWordIds = new Set();
  const directionCounts = { down: 0, right: 0 };
  const arrowCounts = {
    down: 0,
    'down-right': 0,
    right: 0,
    'right-down': 0,
  };

  for (const [wordIndex, word] of words.entries()) {
    const wordId = typeof word?.id === 'string' ? word.id : `word-${wordIndex}`;
    let wordIsValid = true;

    if (!NEWSPAPER_DIRECTIONS.has(word?.direction)) {
      wordIsValid = false;
    } else {
      directionCounts[word.direction] += 1;
    }

    if (
      typeof word?.answer !== 'string' ||
      word.answer.length < 2 ||
      !Array.isArray(word?.cellIndices) ||
      word.cellIndices.length !== word.answer.length
    ) {
      wordIsValid = false;
    }

    if (!wordIsValid) {
      invalidWordIds.add(wordId);
      continue;
    }

    const step = getWordStep(word.direction, columnCount);
    const firstCellIndex = word.cellIndices[0];
    const clueArrow = word.clueArrow ?? word.direction;
    const clueCellIndex = Number.isInteger(word.clueCellIndex)
      ? word.clueCellIndex
      : clueArrow === 'right' || clueArrow === 'right-down'
        ? firstCellIndex - 1
        : firstCellIndex - columnCount;
    const clueKey = getClueKey(clueCellIndex, clueArrow);
    const clue = clueByKey.get(clueKey);

    if (
      !NEWSPAPER_ARROWS.has(clueArrow) ||
      getArrowDirection(clueArrow) !== word.direction ||
      getArrowFirstCellIndex(clueCellIndex, clueArrow, columnCount) !==
        firstCellIndex ||
      !clue ||
      clue.direction !== word.direction ||
      clue.label !== word.clue
    ) {
      wordIsValid = false;
    } else {
      usedClueKeys.add(clueKey);
      arrowCounts[clueArrow] += 1;
    }

    for (const [letterIndex, cellIndex] of word.cellIndices.entries()) {
      const previousCellIndex = word.cellIndices[letterIndex - 1];
      const isInBounds =
        Number.isInteger(cellIndex) && cellIndex >= 0 && cellIndex < expectedCellCount;
      const isContinuous = letterIndex === 0 || cellIndex === previousCellIndex + step;
      const staysInRow =
        word.direction !== 'right' ||
        Math.floor(cellIndex / columnCount) === Math.floor(firstCellIndex / columnCount);

      if (!isInBounds || !isContinuous || !staysInRow || cells[cellIndex]?.type !== 'letter') {
        wordIsValid = false;
        continue;
      }

      const uses = letterUseByCell.get(cellIndex) ?? [];

      if (uses.some((use) => use.direction === word.direction)) {
        conflictingCellIndices.add(cellIndex);
        wordIsValid = false;
      }

      uses.push({ direction: word.direction, wordId });
      letterUseByCell.set(cellIndex, uses);

      const character = word.answer[letterIndex];
      const existingCharacter = characterByCell.get(cellIndex);

      if (existingCharacter && existingCharacter !== character) {
        conflictingCellIndices.add(cellIndex);
        wordIsValid = false;
      } else {
        characterByCell.set(cellIndex, character);
      }
    }

    if (!wordIsValid) {
      invalidWordIds.add(wordId);
    }
  }

  if (invalidWordIds.size > 0) {
    issues.push(`Grid contains ${invalidWordIds.size} invalid word(s).`);
  }

  if (conflictingCellIndices.size > 0) {
    issues.push(`Grid contains ${conflictingCellIndices.size} conflicting letter cell(s).`);
  }

  const orphanLetterIndices = cells.flatMap((cell, cellIndex) =>
    cell?.type === 'letter' && !letterUseByCell.has(cellIndex) ? [cellIndex] : [],
  );
  const orphanClueKeys = [...clueByKey.keys()].filter(
    (clueKey) => !usedClueKeys.has(clueKey),
  );

  if (orphanLetterIndices.length > 0) {
    issues.push(`Grid contains ${orphanLetterIndices.length} orphan letter cell(s).`);
  }

  if (orphanClueKeys.length > 0) {
    issues.push(`Grid contains ${orphanClueKeys.length} orphan clue(s).`);
  }

  if (words.length > 0 && (directionCounts.down === 0 || directionCounts.right === 0)) {
    issues.push('Grid must contain both right and down words.');
  }

  const intersectionCellCount = [...letterUseByCell.values()].filter(
    (uses) => uses.length > 1,
  ).length;

  if (words.length > 1 && intersectionCellCount === 0) {
    issues.push('Grid must contain at least one word intersection.');
  }

  const occupiedCellCount =
    cellTypeCounts.clue + cellTypeCounts.letter + cellTypeCounts['split-clue'];
  const answerLengthTotal = words.reduce(
    (total, word) => total + (typeof word?.answer === 'string' ? word.answer.length : 0),
    0,
  );

  return {
    answerLengthAverage:
      words.length > 0 ? roundRatio(answerLengthTotal / words.length) : 0,
    arrowCounts,
    bentArrowCount: arrowCounts['down-right'] + arrowCounts['right-down'],
    cellTypeCounts,
    clueSlotCount: clueByKey.size,
    columnCount,
    conflictingCellIndices: [...conflictingCellIndices].sort((left, right) => left - right),
    directionCounts,
    expectedCellCount,
    intersectionCellCount,
    invalidWordIds: [...invalidWordIds].sort(),
    issues,
    newspaperReady: issues.length === 0,
    occupiedCellCount,
    occupiedRatio:
      expectedCellCount > 0 ? roundRatio(occupiedCellCount / expectedCellCount) : 0,
    orphanClueKeys: orphanClueKeys.sort(),
    orphanLetterIndices,
    rowCount,
    wordCount: words.length,
  };
}

function validateNewspaperPuzzle(puzzle) {
  const report = analyzeNewspaperPuzzle(puzzle);

  if (!report.newspaperReady) {
    throw new Error(`Puzzle is not newspaper-ready: ${report.issues.join(' ')}`);
  }

  return report;
}

function countEntriesBy(entries, property) {
  return Object.fromEntries(
    [...entries.reduce((counts, entry) => {
      const value = String(entry[property]);
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map())].sort(([left], [right]) =>
      left.localeCompare(right, 'tr', { numeric: true }),
    ),
  );
}

function estimateDenseWordDemand(rowCount, columnCount, averageAnswerLength) {
  if (
    !Number.isInteger(rowCount) ||
    rowCount < 1 ||
    !Number.isInteger(columnCount) ||
    columnCount < 1 ||
    typeof averageAnswerLength !== 'number' ||
    averageAnswerLength <= 0
  ) {
    throw new Error('Grid dimensions and averageAnswerLength must be positive.');
  }

  const cellCount = rowCount * columnCount;
  const membershipUnit = averageAnswerLength + 1;

  return {
    cellCount,
    maximumWordCount: Math.max(1, Math.floor((cellCount * 2) / membershipUnit)),
    minimumWordCount: Math.max(1, Math.ceil(cellCount / membershipUnit)),
  };
}

function analyzeCatalogReadiness(entries, gridSizes) {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Catalog entries are required.');
  }

  const answerLengthTotal = entries.reduce((total, entry) => total + entry.answerLength, 0);
  const averageAnswerLength = answerLengthTotal / entries.length;
  const answerLengths = countEntriesBy(entries, 'answerLength');
  const maximumRecommendedAnswerLength = Math.max(
    2,
    ...gridSizes.map(
      ({ columnCount, rowCount }) => Math.max(columnCount, rowCount) - 1,
    ),
  );
  const recommendedAnswerLengths = Array.from(
    { length: maximumRecommendedAnswerLength - 1 },
    (_, index) => index + 2,
  );

  return {
    answerLengthAverage: roundRatio(averageAnswerLength),
    answerLengths,
    categories: countEntriesBy(entries, 'category'),
    difficulties: countEntriesBy(entries, 'difficulty'),
    entryCount: entries.length,
    estimatedGridDemand: gridSizes.map(({ columnCount, rowCount }) => ({
      columnCount,
      rowCount,
      ...estimateDenseWordDemand(rowCount, columnCount, averageAnswerLength),
    })),
    estimateNote:
      'Word demand uses the catalog average answer length and is a planning estimate, not a successful-fill guarantee.',
    missingRecommendedAnswerLengths: recommendedAnswerLengths.filter(
      (answerLength) => !answerLengths[String(answerLength)],
    ),
    recommendedAnswerLengths,
  };
}

module.exports = {
  analyzeCatalogReadiness,
  analyzeNewspaperPuzzle,
  estimateDenseWordDemand,
  validateNewspaperPuzzle,
};
