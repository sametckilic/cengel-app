const DIFFICULTIES = new Set(['beginner', 'easy', 'hard', 'medium']);
const DEFAULT_CATEGORY_WEIGHT = 0.6;

function validateGenerationRequest(request) {
  if (!Number.isInteger(request.rowCount) || request.rowCount < 3) {
    throw new Error('rowCount must be an integer greater than or equal to 3.');
  }

  if (!Number.isInteger(request.columnCount) || request.columnCount < 3) {
    throw new Error('columnCount must be an integer greater than or equal to 3.');
  }

  if (!DIFFICULTIES.has(request.difficulty)) {
    throw new Error(`Unsupported difficulty: ${request.difficulty}`);
  }

  if (!Array.isArray(request.categories)) {
    throw new Error('categories must be an array.');
  }

  if (
    request.categories.some(
      (category) => typeof category !== 'string' || category.trim().length === 0,
    )
  ) {
    throw new Error('Every category must be a non-empty string.');
  }

  if (
    typeof request.categoryWeight !== 'number' ||
    request.categoryWeight <= 0.5 ||
    request.categoryWeight > 1
  ) {
    throw new Error('categoryWeight must be greater than 0.5 and at most 1.');
  }

  if (!Number.isInteger(request.targetWordCount) || request.targetWordCount < 1) {
    throw new Error('targetWordCount must be a positive integer.');
  }

  if (typeof request.seed !== 'string' || request.seed.trim().length === 0) {
    throw new Error('seed must be a non-empty string.');
  }
}

function hashSeed(seed) {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed) {
  let state = hashSeed(seed);

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

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

function findEligibleClueCandidates(entries, request) {
  validateGenerationRequest(request);

  const maximumAnswerLength = Math.max(request.rowCount, request.columnCount) - 1;
  return entries
    .filter(
      (entry) =>
        entry.difficulty === request.difficulty &&
        entry.answerLength <= maximumAnswerLength,
    )
    .sort((left, right) => left.id.localeCompare(right.id));
}

function getAnswerKey(entry) {
  return typeof entry.answer === 'string' ? entry.answer : entry.id;
}

function takeUniqueCandidates(entries, targetCount, seed, selectedAnswerKeys) {
  if (targetCount <= 0) {
    return [];
  }

  const selected = [];

  for (const entry of shuffleDeterministically(entries, seed)) {
    const answerKey = getAnswerKey(entry);

    if (selectedAnswerKeys.has(answerKey)) {
      continue;
    }

    selected.push(entry);
    selectedAnswerKeys.add(answerKey);

    if (selected.length === targetCount) {
      break;
    }
  }

  return selected;
}

function selectPreferredCandidates(entries, targetCount, seed, selectedAnswerKeys) {
  const standardEntries = entries.filter(({ fallbackOnly }) => !fallbackOnly);
  const fallbackEntries = entries.filter(({ fallbackOnly }) => fallbackOnly);
  const selectedStandard = takeUniqueCandidates(
    standardEntries,
    targetCount,
    seed,
    selectedAnswerKeys,
  );
  const remainingCount = targetCount - selectedStandard.length;

  return [
    ...selectedStandard,
    ...takeUniqueCandidates(
      fallbackEntries,
      remainingCount,
      `${seed}:two-letter`,
      selectedAnswerKeys,
    ),
  ];
}

function selectClueCandidates(entries, request) {
  const eligibleEntries = findEligibleClueCandidates(entries, request);
  const categorySet = new Set(request.categories);
  const themedEntries = eligibleEntries.filter(({ category }) => categorySet.has(category));
  const mixedEntries = eligibleEntries.filter(({ category }) => !categorySet.has(category));
  const themedTarget =
    categorySet.size === 0
      ? 0
      : Math.ceil(request.targetWordCount * request.categoryWeight);
  const uniqueEligibleCount = new Set(eligibleEntries.map(getAnswerKey)).size;
  const uniqueThemedCount = new Set(themedEntries.map(getAnswerKey)).size;

  if (
    uniqueEligibleCount < request.targetWordCount ||
    uniqueThemedCount < themedTarget
  ) {
    const categoryLabel = request.categories.length > 0 ? request.categories.join(', ') : 'none';
    throw new Error(
      `Only ${uniqueEligibleCount} total and ${uniqueThemedCount} themed answer(s) match ` +
        `difficulty "${request.difficulty}", categories "${categoryLabel}", and ` +
        `${request.rowCount}x${request.columnCount}; ${request.targetWordCount} total and ` +
        `${themedTarget} themed requested.`,
    );
  }

  const selectedAnswerKeys = new Set();
  const selectedThemed = selectPreferredCandidates(
    themedEntries,
    themedTarget,
    `${request.seed}:themed`,
    selectedAnswerKeys,
  );
  const mixedTarget = request.targetWordCount - selectedThemed.length;
  const selectedMixed = selectPreferredCandidates(
    mixedEntries,
    mixedTarget,
    `${request.seed}:mixed`,
    selectedAnswerKeys,
  );
  const fallbackTarget = request.targetWordCount - selectedThemed.length - selectedMixed.length;
  const fallbackEntries = selectPreferredCandidates(
    eligibleEntries,
    fallbackTarget,
    `${request.seed}:fallback`,
    selectedAnswerKeys,
  );

  return shuffleDeterministically(
    [...selectedThemed, ...selectedMixed, ...fallbackEntries],
    `${request.seed}:combined`,
  );
}

module.exports = {
  DEFAULT_CATEGORY_WEIGHT,
  createSeededRandom,
  findEligibleClueCandidates,
  selectClueCandidates,
  validateGenerationRequest,
};
