const assert = require('node:assert/strict');
const test = require('node:test');

const {
  analyzeCatalogReadiness,
  analyzeNewspaperPuzzle,
  estimateDenseWordDemand,
  validateNewspaperPuzzle,
} = require('../src/newspaper-grid');

function createDenseFixture() {
  const cells = Array.from({ length: 36 }, () => ({ type: 'letter' }));
  const rowAnswers = ['AAXAA', 'BBXBB', 'CCXCC', 'DDXDD', 'EEXEE'];

  cells[0] = { type: 'clue', label: 'Top left', direction: 'right' };
  cells[3] = {
    type: 'split-clue',
    clues: [
      { label: 'Top right', direction: 'right' },
      { label: 'Vertical', direction: 'down' },
    ],
  };

  for (let rowIndex = 1; rowIndex < 6; rowIndex += 1) {
    cells[rowIndex * 6] = {
      type: 'clue',
      label: `Row ${rowIndex}`,
      direction: 'right',
    };
  }

  return {
    rowCount: 6,
    columnCount: 6,
    cells,
    words: [
      {
        id: 'top-left',
        answer: 'AB',
        cellIndices: [1, 2],
        clue: 'Top left',
        direction: 'right',
      },
      {
        id: 'top-right',
        answer: 'CD',
        cellIndices: [4, 5],
        clue: 'Top right',
        direction: 'right',
      },
      {
        id: 'vertical',
        answer: 'XXXXX',
        cellIndices: [9, 15, 21, 27, 33],
        clue: 'Vertical',
        direction: 'down',
      },
      ...rowAnswers.map((answer, rowIndex) => ({
        id: `row-${rowIndex + 1}`,
        answer,
        cellIndices: Array.from(
          { length: 5 },
          (_, columnOffset) => (rowIndex + 1) * 6 + columnOffset + 1,
        ),
        clue: `Row ${rowIndex + 1}`,
        direction: 'right',
      })),
    ],
  };
}

test('accepts a fully occupied newspaper-style grid contract', () => {
  const report = validateNewspaperPuzzle(createDenseFixture());

  assert.equal(report.newspaperReady, true);
  assert.equal(report.occupiedRatio, 1);
  assert.equal(report.cellTypeCounts.void, 0);
  assert.equal(report.cellTypeCounts['split-clue'], 1);
  assert.equal(report.intersectionCellCount, 5);
  assert.deepEqual(report.orphanLetterIndices, []);
  assert.deepEqual(report.orphanClueKeys, []);
});

test('rejects void and orphan cells in a newspaper-style grid', () => {
  const puzzle = createDenseFixture();
  puzzle.cells[35] = { type: 'void' };
  const report = analyzeNewspaperPuzzle(puzzle);

  assert.equal(report.newspaperReady, false);
  assert.equal(report.cellTypeCounts.void, 1);
  assert.match(report.issues.join(' '), /void cell/);
  assert.throws(() => validateNewspaperPuzzle(puzzle), /not newspaper-ready/);
});

test('reports catalog length gaps and dense word demand', () => {
  const entries = [
    { answerLength: 5, category: 'turkce', difficulty: 'easy' },
    { answerLength: 6, category: 'edebiyat', difficulty: 'medium' },
    { answerLength: 8, category: 'turkce', difficulty: 'easy' },
  ];
  const report = analyzeCatalogReadiness(entries, [
    { rowCount: 8, columnCount: 8 },
  ]);

  assert.deepEqual(report.missingRecommendedAnswerLengths, [2, 3, 4, 7]);
  assert.deepEqual(report.recommendedAnswerLengths, [2, 3, 4, 5, 6, 7]);
  assert.equal(report.estimatedGridDemand[0].cellCount, 64);
  assert.ok(report.estimatedGridDemand[0].minimumWordCount > 0);
  assert.ok(
    report.estimatedGridDemand[0].maximumWordCount >=
      report.estimatedGridDemand[0].minimumWordCount,
  );
});

test('dense word demand rejects invalid dimensions', () => {
  assert.throws(() => estimateDenseWordDemand(0, 8, 6), /must be positive/);
});
