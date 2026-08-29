const assert = require('node:assert/strict');
const test = require('node:test');

const {
  selectArchivePuzzles,
  selectPackPuzzles,
} = require('../data/puzzle-publications.ts');

const puzzles = [
  { id: 'daily-1', title: 'Daily' },
  { id: 'archive-old', title: 'Old archive' },
  { id: 'archive-new', title: 'New archive' },
  { id: 'pack-1', title: 'Pack one' },
  { id: 'pack-2', title: 'Pack two' },
];

const publications = [
  {
    channel: 'pack',
    packId: 'kultur-sanat',
    publicationDate: '2026-08-29',
    puzzleId: 'pack-2',
    puzzleNumber: 2,
    requiredEntitlement: 'premium',
  },
  {
    channel: 'daily',
    publicationDate: '2026-08-29',
    puzzleId: 'daily-1',
    requiredEntitlement: null,
  },
  {
    channel: 'archive',
    publicationDate: '2026-08-01',
    puzzleId: 'archive-old',
    requiredEntitlement: null,
  },
  {
    channel: 'pack',
    packId: 'kultur-sanat',
    publicationDate: '2026-08-29',
    puzzleId: 'pack-1',
    puzzleNumber: 1,
    requiredEntitlement: null,
  },
  {
    channel: 'archive',
    publicationDate: '2026-08-20',
    puzzleId: 'archive-new',
    requiredEntitlement: null,
  },
  {
    channel: 'archive',
    publicationDate: '2026-08-21',
    puzzleId: 'missing-puzzle',
    requiredEntitlement: null,
  },
];

test('selects only available archive publications in newest-first order', () => {
  assert.deepEqual(
    selectArchivePuzzles(puzzles, publications).map(({ puzzle }) => puzzle.id),
    ['archive-new', 'archive-old'],
  );
});

test('selects the requested pack and respects editorial puzzle numbers', () => {
  const selected = selectPackPuzzles(puzzles, publications, 'kultur-sanat');

  assert.deepEqual(
    selected.map(({ puzzle }) => puzzle.id),
    ['pack-1', 'pack-2'],
  );
  assert.deepEqual(
    selected.map(({ publication }) => publication.puzzleNumber),
    [1, 2],
  );
});

test('does not infer membership from a puzzle category', () => {
  assert.deepEqual(selectPackPuzzles(puzzles, publications, 'edebiyat'), []);
});
