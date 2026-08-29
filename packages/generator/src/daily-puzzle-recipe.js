const { validateGenerationRequest } = require('./clue-selection');
const { createNewspaperTopologyById } = require('./newspaper-topology');

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const REVISION_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

function validateIsoDate(date) {
  const match = typeof date === 'string' ? ISO_DATE_PATTERN.exec(date) : null;

  if (!match) {
    throw new Error('Daily puzzle date must use YYYY-MM-DD format.');
  }

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    throw new Error(`Daily puzzle date is not a valid calendar date: ${date}`);
  }

  return date;
}

function createNewspaperPuzzleRecipe({ id, profile, revision, seed, title }) {
  if (!profile || typeof profile !== 'object') {
    throw new Error('Newspaper puzzle profile is required.');
  }

  if (typeof revision !== 'string' || !REVISION_PATTERN.test(revision)) {
    throw new Error('Puzzle revision must contain lowercase letters, numbers, or hyphens.');
  }

  if (typeof id !== 'string' || !REVISION_PATTERN.test(id)) {
    throw new Error('Puzzle ID must contain lowercase letters, numbers, or hyphens.');
  }

  if (!Array.isArray(profile.categories) || profile.categories.length === 0) {
    throw new Error('Newspaper puzzle profile must contain at least one category.');
  }

  const categories = [...profile.categories];
  const isV2 = profile.generatorVersion === 'newspaper-v2';

  if (
    profile.generatorVersion !== undefined &&
    profile.generatorVersion !== 'newspaper-v2'
  ) {
    throw new Error(`Unsupported daily puzzle generator: ${profile.generatorVersion}`);
  }

  const topology = isV2 ? null : createNewspaperTopologyById(profile.topologyId);
  const rowCount = isV2 ? profile.rowCount : topology.rowCount;
  const columnCount = isV2 ? profile.columnCount : topology.columnCount;
  const targetWordCount = isV2
    ? profile.targetWordCount
    : topology.slots.length;
  const seedParts = [
    id,
    revision,
    isV2
      ? `newspaper-v2-${rowCount}x${columnCount}-${targetWordCount}`
      : topology.id,
    profile.difficulty,
    categories.join('+'),
    String(profile.categoryWeight),
  ];
  const recipe = {
    id,
    title: title ?? profile.title ?? 'Günün Bulmacası',
    format: 'newspaper-arrowword',
    ...(isV2
      ? { generatorVersion: 'newspaper-v2' }
      : { topologyId: topology.id }),
    rowCount,
    columnCount,
    difficulty: profile.difficulty,
    categories,
    categoryWeight: profile.categoryWeight,
    seed: seed ?? seedParts.join(':'),
    targetWordCount,
  };

  validateGenerationRequest(recipe);
  return recipe;
}

function createDailyPuzzleRecipe({ date, profile, revision }) {
  const normalizedDate = validateIsoDate(date);

  return createNewspaperPuzzleRecipe({
    id: `gunun-${normalizedDate}`,
    profile,
    revision,
    title: profile?.title ?? 'Günün Bulmacası',
  });
}

module.exports = {
  createDailyPuzzleRecipe,
  createNewspaperPuzzleRecipe,
  validateIsoDate,
};
