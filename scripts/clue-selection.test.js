const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../apps/mobile/data/generated/clue-catalog.json');
const {
  selectClueCandidates,
  validateGenerationRequest,
} = require('./lib/clue-selection');

const baseRequest = {
  categories: ['turkce'],
  categoryWeight: 0.6,
  columnCount: 8,
  difficulty: 'easy',
  rowCount: 8,
  seed: 'daily-2026-08-19',
  targetWordCount: 12,
};

test('the same request and seed produce the same candidates', () => {
  const first = selectClueCandidates(catalog.entries, baseRequest).map(({ id }) => id);
  const second = selectClueCandidates(catalog.entries, baseRequest).map(({ id }) => id);

  assert.deepEqual(first, second);
});

test('catalog preserves full clues and exposes short clues for the grid', () => {
  const entry = catalog.entries.find(({ id }) => id === 'cc_00020afbc4bd4ab15edd98c9');

  assert.equal(entry.clue, 'Bir sözcüğün gerçek anlamının dışında kullanılması');
  assert.equal(entry.shortClue, 'Sözcüğün gerçek anlamı dışı kullanımı');
});

test('catalog marks validated two-letter answers as fallback-only candidates', () => {
  const twoLetterEntries = catalog.entries.filter(({ answerLength }) => answerLength === 2);

  assert.equal(catalog.filters.answerLengthMin, 2);
  assert.equal(twoLetterEntries.length, 34);
  assert.ok(twoLetterEntries.every(({ fallbackOnly }) => fallbackOnly));
  assert.ok(
    catalog.entries
      .filter(({ answerLength }) => answerLength > 2)
      .every(({ fallbackOnly }) => !fallbackOnly),
  );
  assert.equal(
    catalog.entries.find(({ id }) => id === 'cc_a2c74674d5a4dd49369e4969')?.answer,
    'İS',
  );
  assert.ok(catalog.entries.some(({ answerLength }) => answerLength === 3));
  assert.ok(catalog.entries.some(({ answerLength }) => answerLength === 4));
  assert.ok(catalog.entries.every(({ answerLength }) => answerLength >= 2));
  assert.equal(
    catalog.entries.find(({ id }) => id === 'cc_0026ff42198090ac3703353c')?.answer,
    'İREM',
  );
  assert.equal(
    catalog.entries.find(({ id }) => id === 'cc_837b49b34287836f6cffb505')?.answer,
    'İSKONTO',
  );
});

test('a different seed changes the deterministic candidate order', () => {
  const first = selectClueCandidates(catalog.entries, baseRequest).map(({ id }) => id);
  const second = selectClueCandidates(catalog.entries, {
    ...baseRequest,
    seed: 'daily-2026-08-20',
  }).map(({ id }) => id);

  assert.notDeepEqual(first, second);
});

test('selection respects dimensions, difficulty, and weighted categories', () => {
  const request = {
    categories: ['edebiyat'],
    categoryWeight: 0.6,
    columnCount: 10,
    difficulty: 'medium',
    rowCount: 7,
    seed: 'edebiyat-pack-1',
    targetWordCount: 5,
  };
  const selected = selectClueCandidates(catalog.entries, request);
  const themedCount = selected.filter(({ category }) => category === 'edebiyat').length;

  assert.equal(selected.length, request.targetWordCount);
  assert.equal(themedCount, Math.ceil(request.targetWordCount * request.categoryWeight));
  assert.ok(selected.some(({ category }) => category !== 'edebiyat'));
  assert.ok(selected.every(({ difficulty }) => difficulty === request.difficulty));
  assert.ok(selected.every(({ fallbackOnly }) => !fallbackOnly));
  assert.ok(
    selected.every(
      ({ answerLength }) => answerLength <= Math.max(request.rowCount, request.columnCount) - 1,
    ),
  );
});

test('two-letter answers are selected only after standard candidates are exhausted', () => {
  const entries = [
    {
      answerLength: 3,
      category: 'turkce',
      difficulty: 'easy',
      fallbackOnly: false,
      id: 'standard',
    },
    {
      answerLength: 2,
      category: 'turkce',
      difficulty: 'easy',
      fallbackOnly: true,
      id: 'two-letter-fallback',
    },
  ];
  const request = {
    ...baseRequest,
    categoryWeight: 1,
    columnCount: 4,
    rowCount: 4,
    targetWordCount: 1,
  };

  assert.deepEqual(
    selectClueCandidates(entries, request).map(({ id }) => id),
    ['standard'],
  );
  assert.deepEqual(
    selectClueCandidates(entries, { ...request, targetWordCount: 2 })
      .map(({ id }) => id)
      .sort(),
    ['standard', 'two-letter-fallback'],
  );
});

test('an impossible request fails with a descriptive error', () => {
  assert.throws(
    () =>
      selectClueCandidates(catalog.entries, {
        ...baseRequest,
        categories: ['__missing_category__'],
        targetWordCount: 2,
      }),
    /0 themed clue\(s\) match/,
  );
});

test('rectangular generation requests are valid', () => {
  assert.doesNotThrow(() =>
    validateGenerationRequest({
      ...baseRequest,
      columnCount: 12,
      rowCount: 7,
    }),
  );
});

test('category weight must describe a majority', () => {
  assert.throws(
    () => validateGenerationRequest({ ...baseRequest, categoryWeight: 0.5 }),
    /categoryWeight must be greater than 0.5/,
  );
});
