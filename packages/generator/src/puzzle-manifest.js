const {
  findEligibleClueCandidates,
  selectClueCandidates,
  validateGenerationRequest,
} = require('./clue-selection');
const { generatePuzzleLayout } = require('./puzzle-layout');
const { fillNewspaperTopology } = require('./newspaper-fill');
const { validateNewspaperPuzzle } = require('./newspaper-grid');
const { createNewspaperTopologyById } = require('./newspaper-topology');

const SOURCE_CATALOG = 'data/generated/clue-catalog.json';

function validateRecipeDocument(recipeDocument) {
  if (recipeDocument?.schemaVersion !== 1 || !Array.isArray(recipeDocument.recipes)) {
    throw new Error('Puzzle recipe document must use schemaVersion 1 and contain recipes.');
  }

  const recipeIds = new Set();

  for (const recipe of recipeDocument.recipes) {
    if (typeof recipe.id !== 'string' || recipe.id.trim().length === 0) {
      throw new Error('Every puzzle recipe must have a non-empty id.');
    }

    if (recipeIds.has(recipe.id)) {
      throw new Error(`Duplicate puzzle recipe id: ${recipe.id}`);
    }

    recipeIds.add(recipe.id);

    if (typeof recipe.title !== 'string' || recipe.title.trim().length === 0) {
      throw new Error(`Puzzle recipe "${recipe.id}" must have a non-empty title.`);
    }

    validateGenerationRequest(recipe);

    if (recipe.format === 'newspaper-arrowword') {
      if (typeof recipe.topologyId !== 'string' || recipe.topologyId.length === 0) {
        throw new Error(
          `Newspaper puzzle recipe "${recipe.id}" must have a topologyId.`,
        );
      }

      const topology = createNewspaperTopologyById(recipe.topologyId);

      if (
        topology.rowCount !== recipe.rowCount ||
        topology.columnCount !== recipe.columnCount ||
        topology.slots.length !== recipe.targetWordCount
      ) {
        throw new Error(
          `Newspaper puzzle recipe "${recipe.id}" does not match topology "${recipe.topologyId}".`,
        );
      }
    } else if (recipe.format !== undefined || recipe.topologyId !== undefined) {
      throw new Error(`Puzzle recipe "${recipe.id}" has an unsupported format.`);
    }
  }
}

function hasMatchingClue(cell, direction, label) {
  if (cell?.type === 'clue') {
    return cell.direction === direction && cell.label === label;
  }

  return (
    cell?.type === 'split-clue' &&
    cell.clues.some((clue) => clue.direction === direction && clue.label === label)
  );
}

function validateGeneratedPuzzle(puzzle) {
  const expectedCellCount = puzzle.rowCount * puzzle.columnCount;

  if (puzzle.cells.length !== expectedCellCount) {
    throw new Error(
      `Puzzle "${puzzle.id}" has ${puzzle.cells.length} cells; ${expectedCellCount} expected.`,
    );
  }

  if (puzzle.words.length !== puzzle.generation.targetWordCount) {
    throw new Error(
      `Puzzle "${puzzle.id}" has ${puzzle.words.length} words; ` +
        `${puzzle.generation.targetWordCount} expected.`,
    );
  }

  const wordIds = new Set();
  const characterByCellIndex = new Map();
  let themedWordCount = 0;

  for (const word of puzzle.words) {
    if (wordIds.has(word.id)) {
      throw new Error(`Puzzle "${puzzle.id}" contains duplicate word id "${word.id}".`);
    }

    wordIds.add(word.id);

    if (puzzle.categories.includes(word.category)) {
      themedWordCount += 1;
    }

    if (word.cellIndices.length !== word.answer.length) {
      throw new Error(`Puzzle "${puzzle.id}" has an invalid answer length for "${word.id}".`);
    }

    const indexStep = word.direction === 'right' ? 1 : puzzle.columnCount;
    const clueCellIndex = word.cellIndices[0] - indexStep;
    const clueCell = puzzle.cells[clueCellIndex];

    if (!hasMatchingClue(clueCell, word.direction, word.clue)) {
      throw new Error(`Puzzle "${puzzle.id}" has an invalid clue cell for "${word.id}".`);
    }

    word.cellIndices.forEach((index, letterIndex) => {
      if (puzzle.cells[index]?.type !== 'letter') {
        throw new Error(`Puzzle "${puzzle.id}" has a non-letter answer cell for "${word.id}".`);
      }

      if (letterIndex > 0 && index !== word.cellIndices[letterIndex - 1] + indexStep) {
        throw new Error(`Puzzle "${puzzle.id}" has a discontinuous word "${word.id}".`);
      }

      const character = word.answer[letterIndex];
      const existingCharacter = characterByCellIndex.get(index);

      if (existingCharacter && existingCharacter !== character) {
        throw new Error(`Puzzle "${puzzle.id}" has conflicting letters at cell ${index}.`);
      }

      characterByCellIndex.set(index, character);
    });
  }

  const requiredThemedWordCount = Math.ceil(
    puzzle.generation.targetWordCount * puzzle.generation.categoryWeight,
  );

  if (themedWordCount < requiredThemedWordCount) {
    throw new Error(
      `Puzzle "${puzzle.id}" has ${themedWordCount} themed word(s); ` +
        `${requiredThemedWordCount} required.`,
    );
  }

  if (
    !wordIds.has(puzzle.initialSelection.wordId) ||
    !puzzle.words
      .find(({ id }) => id === puzzle.initialSelection.wordId)
      ?.cellIndices.includes(puzzle.initialSelection.cellIndex)
  ) {
    throw new Error(`Puzzle "${puzzle.id}" has an invalid initial selection.`);
  }

  if (puzzle.format === 'newspaper-arrowword') {
    validateNewspaperPuzzle(puzzle);
  }
}

function buildPuzzleDefinition(catalogEntries, recipe) {
  if (recipe.format === 'newspaper-arrowword') {
    const topology = createNewspaperTopologyById(recipe.topologyId);
    const { puzzle } = fillNewspaperTopology(catalogEntries, recipe, topology);

    validateGeneratedPuzzle(puzzle);
    return puzzle;
  }

  const eligibleEntries = findEligibleClueCandidates(catalogEntries, recipe);
  const categorySet = new Set(recipe.categories);
  const themedEligibleCount = eligibleEntries.filter(({ category }) =>
    categorySet.has(category),
  ).length;
  const requiredThemedWordCount = Math.ceil(
    recipe.targetWordCount * recipe.categoryWeight,
  );

  if (
    eligibleEntries.length < recipe.targetWordCount ||
    themedEligibleCount < requiredThemedWordCount
  ) {
    throw new Error(
      `Puzzle recipe "${recipe.id}" has ${eligibleEntries.length} eligible clues and ` +
        `${themedEligibleCount} themed clues for ${recipe.targetWordCount} requested words ` +
        `and ${requiredThemedWordCount} required themed words.`,
    );
  }

  const maximumWeightedPoolSize = Math.floor(
    themedEligibleCount / recipe.categoryWeight,
  );
  const candidatePoolSize = Math.min(
    eligibleEntries.length,
    maximumWeightedPoolSize,
    Math.max(recipe.targetWordCount * 12, 24),
  );
  const candidates = selectClueCandidates(catalogEntries, {
    ...recipe,
    targetWordCount: candidatePoolSize,
  });
  const layout = generatePuzzleLayout(candidates, recipe);
  const initialWord = layout.words[0];
  const puzzle = {
    id: recipe.id,
    title: recipe.title,
    categories: recipe.categories,
    difficulty: recipe.difficulty,
    rowCount: layout.rowCount,
    columnCount: layout.columnCount,
    generation: {
      seed: recipe.seed,
      targetWordCount: recipe.targetWordCount,
      categoryWeight: recipe.categoryWeight,
      intersectionCount: layout.intersectionCount,
    },
    initialSelection: {
      wordId: initialWord.id,
      cellIndex: initialWord.cellIndices[0],
    },
    cells: layout.cells,
    words: layout.words,
  };

  validateGeneratedPuzzle(puzzle);
  return puzzle;
}

function validateDailyPublication(catalog, publication) {
  if (
    publication?.schemaVersion !== 1 ||
    typeof publication.date !== 'string' ||
    typeof publication.profileId !== 'string' ||
    typeof publication.revision !== 'string' ||
    publication.sourceCatalog !== SOURCE_CATALOG ||
    publication.quality?.passed !== true ||
    !Array.isArray(publication.quality?.issues) ||
    publication.quality.issues.length > 0
  ) {
    throw new Error('Published daily puzzle has an invalid publication contract.');
  }

  if (JSON.stringify(publication.rights) !== JSON.stringify(catalog.rights)) {
    throw new Error(`Published daily puzzle "${publication.date}" has mismatched rights.`);
  }

  if (
    publication.puzzle?.id !== `gunun-${publication.date}` ||
    publication.recipe?.id !== publication.puzzle.id ||
    publication.recipe?.seed !== publication.puzzle.generation?.seed
  ) {
    throw new Error(`Published daily puzzle "${publication.date}" has inconsistent identity.`);
  }

  validateRecipeDocument({ schemaVersion: 1, recipes: [publication.recipe] });
  validateGeneratedPuzzle(publication.puzzle);
  return publication.puzzle;
}

function buildPuzzleManifest(catalog, recipeDocument, dailyPublications = []) {
  validateRecipeDocument(recipeDocument);

  if (!Array.isArray(dailyPublications)) {
    throw new Error('Daily publications must be an array.');
  }

  const puzzles = [
    ...recipeDocument.recipes.map((recipe) =>
      buildPuzzleDefinition(catalog.entries, recipe),
    ),
    ...dailyPublications.map((publication) =>
      validateDailyPublication(catalog, publication),
    ),
  ];
  const puzzleIds = new Set(puzzles.map(({ id }) => id));

  if (puzzleIds.size !== puzzles.length) {
    throw new Error('Generated puzzle ids must be unique.');
  }

  return {
    schemaVersion: 1,
    sourceCatalog: SOURCE_CATALOG,
    rights: catalog.rights,
    puzzles,
  };
}

module.exports = {
  buildPuzzleManifest,
  validateDailyPublication,
  validateGeneratedPuzzle,
  validateRecipeDocument,
};
