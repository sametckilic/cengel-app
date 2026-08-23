const { createSeededRandom, validateGenerationRequest } = require('./clue-selection');
const { validateNewspaperPuzzle } = require('./newspaper-grid');
const { validateNewspaperTopology } = require('./newspaper-topology');

const DEFAULT_MAX_SEARCH_NODES = 500_000;
const CLUE_DIRECTION_ORDER = ['right', 'down'];

function shuffleDeterministically(entries, seed) {
  const shuffled = [...entries];
  const random = createSeededRandom(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const replacementIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[replacementIndex]] = [
      shuffled[replacementIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function buildSlotMetadata(topology) {
  const slotUseCountByCell = new Map();

  for (const slot of topology.slots) {
    for (const cellIndex of slot.cellIndices) {
      slotUseCountByCell.set(cellIndex, (slotUseCountByCell.get(cellIndex) ?? 0) + 1);
    }
  }

  return new Map(
    topology.slots.map((slot, slotIndex) => [
      slot.id,
      {
        intersectionDegree: slot.cellIndices.filter(
          (cellIndex) => slotUseCountByCell.get(cellIndex) > 1,
        ).length,
        slotIndex,
      },
    ]),
  );
}

function createCandidateDomains(entries, request, topology) {
  const requiredLengths = new Set(topology.slots.map(({ cellIndices }) => cellIndices.length));
  const eligibleEntries = entries
    .filter(
      (entry) =>
        entry.difficulty === request.difficulty &&
        requiredLengths.has(entry.answerLength) &&
        typeof entry.answer === 'string' &&
        entry.answer.length === entry.answerLength,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const entriesByLength = new Map();

  for (const answerLength of requiredLengths) {
    const candidates = eligibleEntries.filter((entry) => entry.answerLength === answerLength);

    if (candidates.length === 0) {
      throw new Error(
        `Catalog has no ${request.difficulty} answer with length ${answerLength}.`,
      );
    }

    entriesByLength.set(
      answerLength,
      shuffleDeterministically(candidates, `${request.seed}:length:${answerLength}`),
    );
  }

  return new Map(
    topology.slots.map((slot) => [slot.id, entriesByLength.get(slot.cellIndices.length)]),
  );
}

function buildPuzzleCells(topology, assignments) {
  const slotsByClueCell = new Map();

  for (const slot of topology.slots) {
    const clueSlots = slotsByClueCell.get(slot.clueCellIndex) ?? [];
    clueSlots.push(slot);
    slotsByClueCell.set(slot.clueCellIndex, clueSlots);
  }

  return topology.cells.map((cell, cellIndex) => {
    if (cell.type === 'letter') {
      return { type: 'letter' };
    }

    const clueSlots = slotsByClueCell.get(cellIndex);
    const clues = clueSlots
      .map((slot) => ({
        direction: slot.direction,
        label: assignments.get(slot.id).shortClue,
      }))
      .sort(
        ({ direction: left }, { direction: right }) =>
          CLUE_DIRECTION_ORDER.indexOf(left) - CLUE_DIRECTION_ORDER.indexOf(right),
      );

    if (clues.length === 1) {
      return { type: 'clue', ...clues[0] };
    }

    return { type: 'split-clue', clues };
  });
}

function fillNewspaperTopology(entries, request, topology, options = {}) {
  validateGenerationRequest(request);
  const topologyReport = validateNewspaperTopology(topology);

  if (request.rowCount !== topology.rowCount || request.columnCount !== topology.columnCount) {
    throw new Error('Generation request dimensions must match the newspaper topology.');
  }

  if (request.targetWordCount !== topology.slots.length) {
    throw new Error(
      `Generation request targets ${request.targetWordCount} words; topology requires ${topology.slots.length}.`,
    );
  }

  const maxSearchNodes = options.maxSearchNodes ?? DEFAULT_MAX_SEARCH_NODES;

  if (!Number.isInteger(maxSearchNodes) || maxSearchNodes < 1) {
    throw new Error('maxSearchNodes must be a positive integer.');
  }

  const domains = createCandidateDomains(entries, request, topology);
  const metadataBySlot = buildSlotMetadata(topology);
  const clueUseCountByCell = topology.slots.reduce((counts, slot) => {
    counts.set(slot.clueCellIndex, (counts.get(slot.clueCellIndex) ?? 0) + 1);
    return counts;
  }, new Map());
  const categorySet = new Set(request.categories);
  const requiredThemedWordCount =
    categorySet.size === 0 ? 0 : Math.ceil(topology.slots.length * request.categoryWeight);
  const assignments = new Map();
  const characterByCell = new Map();
  const usedAnswers = new Set();
  let backtrackCount = 0;
  let searchNodeCount = 0;
  let themedWordCount = 0;

  function matchesAssignedLetters(slot, entry) {
    return slot.cellIndices.every((cellIndex, letterIndex) => {
      const assignedCharacter = characterByCell.get(cellIndex);
      return !assignedCharacter || assignedCharacter === entry.answer[letterIndex];
    });
  }

  function getCandidateState(slot) {
    const candidates = domains
      .get(slot.id)
      .filter((entry) => !usedAnswers.has(entry.answer) && matchesAssignedLetters(slot, entry));
    const assignedCharacterCount = slot.cellIndices.filter((cellIndex) =>
      characterByCell.has(cellIndex),
    ).length;
    const metadata = metadataBySlot.get(slot.id);

    return { assignedCharacterCount, candidates, metadata, slot };
  }

  function compareCandidateStates(left, right) {
    const leftHasPattern = left.assignedCharacterCount > 0;
    const rightHasPattern = right.assignedCharacterCount > 0;

    if (leftHasPattern !== rightHasPattern) {
      return leftHasPattern ? -1 : 1;
    }

    if (!leftHasPattern && left.metadata.intersectionDegree !== right.metadata.intersectionDegree) {
      return right.metadata.intersectionDegree - left.metadata.intersectionDegree;
    }

    if (left.candidates.length !== right.candidates.length) {
      return left.candidates.length - right.candidates.length;
    }

    if (left.metadata.intersectionDegree !== right.metadata.intersectionDegree) {
      return right.metadata.intersectionDegree - left.metadata.intersectionDegree;
    }

    return left.metadata.slotIndex - right.metadata.slotIndex;
  }

  function chooseNextSlot() {
    return topology.slots
      .filter((slot) => !assignments.has(slot.id))
      .map(getCandidateState)
      .sort(compareCandidateStates)[0];
  }

  function orderCandidates(candidates, slot) {
    const prioritizeShortClues = clueUseCountByCell.get(slot.clueCellIndex) > 1;
    const sortForCell = (entriesToSort) =>
      prioritizeShortClues
        ? [...entriesToSort].sort(
            (left, right) => left.shortClue.length - right.shortClue.length,
          )
        : entriesToSort;

    if (themedWordCount >= requiredThemedWordCount) {
      return sortForCell(candidates);
    }

    return [
      ...sortForCell(candidates.filter(({ category }) => categorySet.has(category))),
      ...sortForCell(candidates.filter(({ category }) => !categorySet.has(category))),
    ];
  }

  function search() {
    if (assignments.size === topology.slots.length) {
      return themedWordCount >= requiredThemedWordCount;
    }

    if (
      themedWordCount + (topology.slots.length - assignments.size) <
      requiredThemedWordCount
    ) {
      return false;
    }

    const candidateState = chooseNextSlot();

    if (!candidateState || candidateState.candidates.length === 0) {
      return false;
    }

    for (const entry of orderCandidates(candidateState.candidates, candidateState.slot)) {
      if (searchNodeCount >= maxSearchNodes) {
        return false;
      }

      const isThemed = categorySet.has(entry.category);
      const remainingSlotCount = topology.slots.length - assignments.size - 1;

      if (themedWordCount + Number(isThemed) + remainingSlotCount < requiredThemedWordCount) {
        continue;
      }

      searchNodeCount += 1;
      assignments.set(candidateState.slot.id, entry);
      usedAnswers.add(entry.answer);

      const newlyAssignedCellIndices = [];

      candidateState.slot.cellIndices.forEach((cellIndex, letterIndex) => {
        if (!characterByCell.has(cellIndex)) {
          characterByCell.set(cellIndex, entry.answer[letterIndex]);
          newlyAssignedCellIndices.push(cellIndex);
        }
      });

      if (isThemed) {
        themedWordCount += 1;
      }

      if (search()) {
        return true;
      }

      if (isThemed) {
        themedWordCount -= 1;
      }

      for (const cellIndex of newlyAssignedCellIndices) {
        characterByCell.delete(cellIndex);
      }

      usedAnswers.delete(entry.answer);
      assignments.delete(candidateState.slot.id);
      backtrackCount += 1;
    }

    return false;
  }

  if (!search()) {
    const suffix =
      searchNodeCount >= maxSearchNodes
        ? ` Search stopped at the ${maxSearchNodes}-node limit.`
        : '';
    throw new Error(`Could not fill topology "${topology.id}" from the clue catalog.${suffix}`);
  }

  const words = topology.slots.map((slot) => {
    const entry = assignments.get(slot.id);

    return {
      id: `${request.id}-${slot.id}`,
      answer: entry.answer,
      category: entry.category,
      clue: entry.shortClue,
      direction: slot.direction,
      cellIndices: slot.cellIndices,
    };
  });
  const puzzle = {
    format: 'newspaper-arrowword',
    id: request.id,
    title: request.title,
    categories: [...request.categories],
    difficulty: request.difficulty,
    rowCount: topology.rowCount,
    columnCount: topology.columnCount,
    generation: {
      seed: request.seed,
      targetWordCount: request.targetWordCount,
      categoryWeight: request.categoryWeight,
      intersectionCount: topologyReport.intersectionCellCount,
      topologyId: topology.id,
    },
    initialSelection: {
      wordId: words[0].id,
      cellIndex: words[0].cellIndices[0],
    },
    cells: buildPuzzleCells(topology, assignments),
    words,
  };
  const puzzleReport = validateNewspaperPuzzle(puzzle);

  return {
    puzzle,
    diagnostics: {
      backtrackCount,
      fallbackWordCount: [...assignments.values()].filter(({ fallbackOnly }) => fallbackOnly)
        .length,
      requiredThemedWordCount,
      searchNodeCount,
      themedWordCount,
      topology: topologyReport,
      validation: puzzleReport,
    },
  };
}

module.exports = {
  DEFAULT_MAX_SEARCH_NODES,
  fillNewspaperTopology,
};
