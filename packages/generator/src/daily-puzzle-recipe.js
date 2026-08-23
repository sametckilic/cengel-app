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

function createDailyPuzzleRecipe({ date, profile, revision }) {
  const normalizedDate = validateIsoDate(date);

  if (!profile || typeof profile !== 'object') {
    throw new Error('Daily puzzle profile is required.');
  }

  if (typeof revision !== 'string' || !REVISION_PATTERN.test(revision)) {
    throw new Error('Daily puzzle revision must contain lowercase letters, numbers, or hyphens.');
  }

  if (!Array.isArray(profile.categories) || profile.categories.length === 0) {
    throw new Error('Daily puzzle profile must contain at least one category.');
  }

  const topology = createNewspaperTopologyById(profile.topologyId);
  const id = `gunun-${normalizedDate}`;
  const categories = [...profile.categories];
  const seedParts = [
    id,
    revision,
    topology.id,
    profile.difficulty,
    categories.join('+'),
    String(profile.categoryWeight),
  ];
  const recipe = {
    id,
    title: profile.title ?? 'Günün Bulmacası',
    format: 'newspaper-arrowword',
    topologyId: topology.id,
    rowCount: topology.rowCount,
    columnCount: topology.columnCount,
    difficulty: profile.difficulty,
    categories,
    categoryWeight: profile.categoryWeight,
    seed: seedParts.join(':'),
    targetWordCount: topology.slots.length,
  };

  validateGenerationRequest(recipe);
  return recipe;
}

module.exports = {
  createDailyPuzzleRecipe,
  validateIsoDate,
};
