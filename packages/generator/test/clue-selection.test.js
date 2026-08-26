const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const {
  findEligibleClueCandidates,
  selectClueCandidates,
  validateGenerationRequest,
} = require('../src/clue-selection');
const {
  isSupportedSourceGridAnswer,
  normalizeGridAnswer,
} = require('../src/grid-answer');

const baseRequest = {
  categories: ['turkce'],
  categoryWeight: 0.6,
  columnCount: 8,
  difficulty: 'easy',
  rowCount: 8,
  seed: 'daily-2026-08-19',
  targetWordCount: 12,
};

const readySourceRecords = readFileSync(
  'datasets/crossword_clues_gameplay_ready.jsonl',
  'utf8',
)
  .trim()
  .split(/\r?\n/)
  .map(JSON.parse)
  .filter(({ gameplay_status: gameplayStatus }) => gameplayStatus === 'ready');

test('the same request and seed produce the same candidates', () => {
  const first = selectClueCandidates(catalog.entries, baseRequest).map(({ id }) => id);
  const second = selectClueCandidates(catalog.entries, baseRequest).map(({ id }) => id);

  assert.deepEqual(first, second);
});

test('catalog preserves full clues and exposes short clues for the grid', () => {
  const entry = catalog.entries.find(
    ({ clue, shortClue }) => clue.length > shortClue.length,
  );

  assert.ok(entry);
  assert.ok(entry.clue.length > entry.shortClue.length);
  assert.ok(entry.shortClue.length > 0);
});

test('catalog keeps every gameplay-ready clue, including alternative clues for an answer', () => {
  const sourceAnswerCount = new Set(
    readySourceRecords.map(({ answer_normalized: answer }) => normalizeGridAnswer(answer)),
  ).size;
  const catalogAnswerCount = new Set(catalog.entries.map(({ answer }) => answer)).size;

  assert.equal(catalog.filters.gameplayStatus, 'ready');
  assert.equal(catalog.filters.gameplayScoreMin, null);
  assert.equal(catalog.filters.clueQualityMin, null);
  assert.equal(catalog.entries.length, readySourceRecords.length);
  assert.equal(catalogAnswerCount, sourceAnswerCount);
  assert.ok(catalog.entries.length > catalogAnswerCount);
});

test('catalog marks validated two-letter answers as fallback-only candidates', () => {
  const twoLetterEntries = catalog.entries.filter(({ answerLength }) => answerLength === 2);

  assert.equal(catalog.filters.answerLengthMin, null);
  assert.equal(catalog.filters.answerLengthMax, null);
  assert.ok(twoLetterEntries.length > 0);
  assert.ok(twoLetterEntries.every(({ fallbackOnly }) => fallbackOnly));
  assert.ok(
    catalog.entries
      .filter(({ answerLength }) => answerLength > 2)
      .every(({ fallbackOnly }) => !fallbackOnly),
  );
  assert.ok(catalog.entries.some(({ answer }) => answer === 'İS'));
  assert.ok(catalog.entries.some(({ answerLength }) => answerLength === 3));
  assert.ok(catalog.entries.some(({ answerLength }) => answerLength === 4));
  assert.ok(catalog.entries.some(({ answerLength }) => answerLength === 9));
  assert.ok(catalog.entries.some(({ answerLength }) => answerLength === 10));
  assert.ok(catalog.entries.some(({ answerLength }) => answerLength === 11));
  assert.ok(catalog.entries.some(({ answerLength }) => answerLength === 12));
  assert.ok(catalog.entries.every(({ answerLength }) => answerLength >= 2));
  assert.ok(catalog.entries.some(({ answer }) => answer === 'İREM'));
  assert.ok(catalog.entries.some(({ answer }) => answer === 'İSKONTO'));
});

test('folds Turkish circumflex letters into system-keyboard grid letters', () => {
  assert.equal(isSupportedSourceGridAnswer('KÂĞIT'), true);
  assert.equal(isSupportedSourceGridAnswer('MİLLÎ'), true);
  assert.equal(isSupportedSourceGridAnswer('SÜKÛNET'), true);
  assert.equal(isSupportedSourceGridAnswer('ARA-BUL'), false);
  assert.equal(normalizeGridAnswer('KÂĞIT MİLLÎ SÜKÛNET'), 'KAĞIT MİLLİ SÜKUNET');
});

test('catalog maps source expert difficulty to the product hard tier', () => {
  const sourceExpertEntry = catalog.entries.find(
    ({ id }) => id === 'cc_0648b1572486d3d19ec7a006',
  );

  assert.equal(sourceExpertEntry?.difficulty, 'hard');
  assert.ok(
    catalog.entries.every(({ difficulty }) =>
      ['beginner', 'easy', 'medium', 'hard'].includes(difficulty),
    ),
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

test('selection keeps answer variants in the pool but never repeats an answer in one puzzle', () => {
  const entries = [
    {
      answer: 'AYNI',
      answerLength: 4,
      category: 'turkce',
      difficulty: 'easy',
      fallbackOnly: false,
      id: 'same-answer-first-clue',
    },
    {
      answer: 'AYNI',
      answerLength: 4,
      category: 'turkce',
      difficulty: 'easy',
      fallbackOnly: false,
      id: 'same-answer-second-clue',
    },
    {
      answer: 'BASKA',
      answerLength: 5,
      category: 'turkce',
      difficulty: 'easy',
      fallbackOnly: false,
      id: 'different-answer',
    },
  ];
  const selected = selectClueCandidates(entries, {
    ...baseRequest,
    categoryWeight: 1,
    targetWordCount: 2,
  });

  assert.equal(selected.length, 2);
  assert.equal(new Set(selected.map(({ answer }) => answer)).size, 2);
});

test('an impossible request fails with a descriptive error', () => {
  assert.throws(
    () =>
      selectClueCandidates(catalog.entries, {
        ...baseRequest,
        categories: ['__missing_category__'],
        targetWordCount: 2,
      }),
    /0 themed answer\(s\) match/,
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

test('grid dimensions, rather than the catalog, cap eligible answer length', () => {
  const compactEntries = findEligibleClueCandidates(catalog.entries, {
    ...baseRequest,
    columnCount: 7,
    rowCount: 7,
  });
  const largeEntries = findEligibleClueCandidates(catalog.entries, {
    ...baseRequest,
    columnCount: 13,
    rowCount: 10,
  });

  assert.ok(compactEntries.every(({ answerLength }) => answerLength <= 6));
  assert.ok(largeEntries.some(({ answerLength }) => answerLength > 8));
  assert.ok(largeEntries.every(({ answerLength }) => answerLength <= 12));
});

test('category weight must describe a majority', () => {
  assert.throws(
    () => validateGenerationRequest({ ...baseRequest, categoryWeight: 0.5 }),
    /categoryWeight must be greater than 0.5/,
  );
});
