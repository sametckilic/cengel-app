const DEFAULT_CLUE_TEXT_POLICY = Object.freeze({
  maximumSingleClueUnits: 24,
  maximumSplitClueUnits: 23,
});

const NARROW_CHARACTERS = new Set(Array.from('Iİıiljtfr'));
const WIDE_CHARACTERS = new Set(Array.from('MWmwŞĞÖÜÇ'));
const PUNCTUATION_PATTERN = /[.,:;!?()'’\-]/u;

function normalizeClueText(value) {
  return typeof value === 'string' ? value.trim().replace(/\s+/gu, ' ') : '';
}

function measureClueTextUnits(value) {
  const text = normalizeClueText(value);
  const units = Array.from(text).reduce((total, character) => {
    if (/\s/u.test(character)) {
      return total + 0.45;
    }

    if (PUNCTUATION_PATTERN.test(character)) {
      return total + 0.5;
    }

    if (NARROW_CHARACTERS.has(character)) {
      return total + 0.65;
    }

    if (WIDE_CHARACTERS.has(character)) {
      return total + 1.1;
    }

    return total + 1;
  }, 0);

  return Number(units.toFixed(2));
}

function resolveClueTextPolicy(overrides = {}) {
  const policy = { ...DEFAULT_CLUE_TEXT_POLICY, ...overrides };

  for (const field of ['maximumSingleClueUnits', 'maximumSplitClueUnits']) {
    if (typeof policy[field] !== 'number' || policy[field] <= 0) {
      throw new Error(`${field} must be a positive number.`);
    }
  }

  if (policy.maximumSplitClueUnits > policy.maximumSingleClueUnits) {
    throw new Error(
      'maximumSplitClueUnits cannot be greater than maximumSingleClueUnits.',
    );
  }

  return policy;
}

function analyzeClueTextFit(value, isSplitClue, policyOverrides) {
  const policy = resolveClueTextPolicy(policyOverrides);
  const units = measureClueTextUnits(value);
  const maximumUnits = isSplitClue
    ? policy.maximumSplitClueUnits
    : policy.maximumSingleClueUnits;

  return {
    fits: units <= maximumUnits,
    maximumUnits,
    units,
  };
}

module.exports = {
  DEFAULT_CLUE_TEXT_POLICY,
  analyzeClueTextFit,
  measureClueTextUnits,
  normalizeClueText,
  resolveClueTextPolicy,
};
