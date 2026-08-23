const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../apps/mobile/data/generated/clue-catalog.json');
const { fillNewspaperTopology } = require('./lib/newspaper-fill');
const { validateNewspaperPuzzle } = require('./lib/newspaper-grid');
const {
  createNewspaper9x10Topology,
  createNewspaperBeginner7x7Topology,
  createNewspaperMedium8x8Topology,
  createNewspaperPrototypeTopology,
  validateNewspaperTopology,
} = require('./lib/newspaper-topology');

const request = {
  id: 'newspaper-prototype-8x8',
  title: 'Günün 8×8 Çengel Bulmacası',
  categories: ['turkce', 'genel_kultur'],
  categoryWeight: 0.6,
  columnCount: 8,
  difficulty: 'easy',
  rowCount: 8,
  seed: 'newspaper-prototype-8x8-v2',
  targetWordCount: 17,
};

test('defines a balanced, fully occupied 8x8 newspaper topology', () => {
  const topology = createNewspaperPrototypeTopology();
  const report = validateNewspaperTopology(topology);

  assert.deepEqual(report, {
    clueCellCount: 15,
    intersectionCellCount: 15,
    letterCellCount: 49,
    slotCount: 17,
    splitClueCellCount: 2,
  });
  assert.equal(topology.cells[0].type, 'clue');
  assert.deepEqual(
    topology.slots.filter(({ clueCellIndex }) => clueCellIndex === 0).map(({ direction }) => direction),
    ['down'],
  );
  assert.equal(topology.slots.filter(({ direction }) => direction === 'right').length, 9);
  assert.equal(topology.slots.filter(({ direction }) => direction === 'down').length, 8);
  assert.ok(topology.slots.every(({ direction }) => ['down', 'right'].includes(direction)));
  assert.ok(topology.cells.every(({ type }) => type === 'clue' || type === 'letter'));
});

test('fills the prototype deterministically from the real clue catalog', () => {
  const topology = createNewspaperPrototypeTopology();
  const firstResult = fillNewspaperTopology(catalog.entries, request, topology);
  const secondResult = fillNewspaperTopology(catalog.entries, request, topology);
  const { diagnostics, puzzle } = firstResult;

  assert.deepEqual(firstResult, secondResult);
  assert.equal(puzzle.format, 'newspaper-arrowword');
  assert.equal(puzzle.rowCount, 8);
  assert.equal(puzzle.columnCount, 8);
  assert.equal(puzzle.cells.length, 64);
  assert.equal(puzzle.words.length, 17);
  assert.equal(puzzle.cells.filter(({ type }) => type === 'split-clue').length, 2);
  assert.ok(
    puzzle.words.every((word) => {
      const catalogEntry = catalog.entries.find(({ answer }) => answer === word.answer);
      return word.clue === catalogEntry?.shortClue;
    }),
  );
  assert.ok(puzzle.cells.every(({ type }) => type !== 'void'));
  assert.deepEqual(diagnostics.validation.directionCounts, { down: 8, right: 9 });
  assert.equal(diagnostics.validation.intersectionCellCount, 15);
  assert.equal(diagnostics.fallbackWordCount, 4);
  assert.equal(puzzle.words.filter(({ answer }) => answer.length === 2).length, 4);
  assert.ok(diagnostics.themedWordCount >= diagnostics.requiredThemedWordCount);
  assert.doesNotThrow(() => validateNewspaperPuzzle(puzzle));
});

test('fills a balanced, fully occupied 9x10 topology from the real clue catalog', () => {
  const topology = createNewspaper9x10Topology();
  const topologyReport = validateNewspaperTopology(topology);
  const wideRequest = {
    id: 'newspaper-wide-9x10',
    title: 'Geniş 9×10 Çengel Bulmacası',
    categories: ['turkce', 'genel_kultur'],
    categoryWeight: 0.6,
    columnCount: 10,
    difficulty: 'easy',
    rowCount: 9,
    seed: 'newspaper-wide-9x10-v1',
    targetWordCount: 25,
  };
  const firstResult = fillNewspaperTopology(catalog.entries, wideRequest, topology);
  const secondResult = fillNewspaperTopology(catalog.entries, wideRequest, topology);
  const { diagnostics, puzzle: widePuzzle } = firstResult;

  assert.deepEqual(firstResult, secondResult);
  assert.deepEqual(topologyReport, {
    clueCellCount: 20,
    intersectionCellCount: 25,
    letterCellCount: 70,
    slotCount: 25,
    splitClueCellCount: 5,
  });
  assert.deepEqual(diagnostics.validation.directionCounts, { down: 11, right: 14 });
  assert.equal(widePuzzle.rowCount, 9);
  assert.equal(widePuzzle.columnCount, 10);
  assert.equal(widePuzzle.words.length, 25);
  assert.equal(widePuzzle.cells.length, 90);
  assert.ok(widePuzzle.cells.every(({ type }) => type !== 'void'));
  assert.ok(diagnostics.themedWordCount >= diagnostics.requiredThemedWordCount);
  assert.doesNotThrow(() => validateNewspaperPuzzle(widePuzzle));
});

test('fills a compact 7x7 beginner topology with a geography majority', () => {
  const topology = createNewspaperBeginner7x7Topology();
  const topologyReport = validateNewspaperTopology(topology);
  const geographyRequest = {
    id: 'cografya-baslangic-002',
    title: 'Coğrafya: Başlangıç',
    categories: ['cografya'],
    categoryWeight: 0.58,
    columnCount: 7,
    difficulty: 'beginner',
    rowCount: 7,
    seed: 'cografya-baslangic-002-v1',
    targetWordCount: 12,
  };
  const firstResult = fillNewspaperTopology(catalog.entries, geographyRequest, topology);
  const secondResult = fillNewspaperTopology(catalog.entries, geographyRequest, topology);
  const { diagnostics, puzzle } = firstResult;

  assert.deepEqual(firstResult, secondResult);
  assert.deepEqual(topologyReport, {
    clueCellCount: 11,
    intersectionCellCount: 9,
    letterCellCount: 38,
    slotCount: 12,
    splitClueCellCount: 1,
  });
  assert.deepEqual(diagnostics.validation.directionCounts, { down: 5, right: 7 });
  assert.equal(diagnostics.requiredThemedWordCount, 7);
  assert.equal(diagnostics.themedWordCount, 7);
  assert.equal(diagnostics.fallbackWordCount, 2);
  assert.equal(puzzle.rowCount, 7);
  assert.equal(puzzle.columnCount, 7);
  assert.equal(puzzle.words.length, 12);
  assert.equal(puzzle.cells.length, 49);
  assert.ok(puzzle.cells.every(({ type }) => type !== 'void'));
  assert.doesNotThrow(() => validateNewspaperPuzzle(puzzle));
});

test('fills a balanced 8x8 medium topology with a literature majority', () => {
  const topology = createNewspaperMedium8x8Topology();
  const topologyReport = validateNewspaperTopology(topology);
  const literatureRequest = {
    id: 'edebiyat-orta-002',
    title: 'Edebiyat: Orta',
    categories: ['edebiyat'],
    categoryWeight: 0.53,
    columnCount: 8,
    difficulty: 'medium',
    rowCount: 8,
    seed: 'edebiyat-orta-002-v1',
    targetWordCount: 13,
  };
  const firstResult = fillNewspaperTopology(catalog.entries, literatureRequest, topology);
  const secondResult = fillNewspaperTopology(catalog.entries, literatureRequest, topology);
  const { diagnostics, puzzle } = firstResult;

  assert.deepEqual(firstResult, secondResult);
  assert.deepEqual(topologyReport, {
    clueCellCount: 9,
    intersectionCellCount: 12,
    letterCellCount: 55,
    slotCount: 13,
    splitClueCellCount: 4,
  });
  assert.deepEqual(diagnostics.validation.directionCounts, { down: 5, right: 8 });
  assert.equal(diagnostics.requiredThemedWordCount, 7);
  assert.equal(diagnostics.themedWordCount, 7);
  assert.equal(diagnostics.fallbackWordCount, 0);
  assert.equal(puzzle.rowCount, 8);
  assert.equal(puzzle.columnCount, 8);
  assert.equal(puzzle.words.length, 13);
  assert.equal(puzzle.cells.length, 64);
  assert.ok(puzzle.cells.every(({ type }) => type !== 'void'));
  assert.doesNotThrow(() => validateNewspaperPuzzle(puzzle));
});
