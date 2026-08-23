const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const { selectClueCandidates } = require('../src/clue-selection');
const { generatePuzzleLayout } = require('../src/puzzle-layout');

function createLayout(request, candidateCount) {
  const candidates = selectClueCandidates(catalog.entries, {
    ...request,
    targetWordCount: candidateCount,
  });

  return generatePuzzleLayout(candidates, request);
}

function assertValidLayout(layout) {
  assert.equal(layout.cells.length, layout.rowCount * layout.columnCount);

  const characterByCellIndex = new Map();

  for (const word of layout.words) {
    assert.equal(word.cellIndices.length, word.answer.length);
    assert.equal(
      word.clue,
      catalog.entries.find(({ id }) => id === word.id)?.shortClue,
    );

    const firstCellIndex = word.cellIndices[0];
    const clueCellIndex =
      word.direction === 'right'
        ? firstCellIndex - 1
        : firstCellIndex - layout.columnCount;
    const clueCell = layout.cells[clueCellIndex];

    assert.deepEqual(clueCell, {
      type: 'clue',
      label: word.clue,
      direction: word.direction,
    });

    word.cellIndices.forEach((index, letterIndex) => {
      assert.equal(layout.cells[index].type, 'letter');

      const currentCharacter = characterByCellIndex.get(index);
      const nextCharacter = word.answer[letterIndex];

      if (currentCharacter) {
        assert.equal(currentCharacter, nextCharacter);
      } else {
        characterByCellIndex.set(index, nextCharacter);
      }
    });
  }
}

test('generates a deterministic 8x8 layout from the real catalog', () => {
  const request = {
    categories: ['turkce'],
    categoryWeight: 0.6,
    columnCount: 8,
    difficulty: 'easy',
    rowCount: 8,
    seed: 'daily-layout-8x8',
    targetWordCount: 6,
  };
  const first = createLayout(request, 60);
  const second = createLayout(request, 60);

  assert.deepEqual(first, second);
  assert.equal(first.words.length, request.targetWordCount);
  assert.ok(first.intersectionCount >= request.targetWordCount - 1);
  assertValidLayout(first);
});

test('generates a rectangular category-specific layout', () => {
  const request = {
    categories: ['edebiyat'],
    categoryWeight: 0.6,
    columnCount: 12,
    difficulty: 'medium',
    rowCount: 7,
    seed: 'edebiyat-layout-7x12',
    targetWordCount: 5,
  };
  const layout = createLayout(request, 24);

  assert.equal(layout.rowCount, 7);
  assert.equal(layout.columnCount, 12);
  assert.equal(layout.words.length, request.targetWordCount);
  assertValidLayout(layout);
});

test('rejects a layout that cannot connect the requested words', () => {
  const entries = [
    {
      id: 'a',
      answer: 'AAAAA',
      answerLength: 5,
      clue: 'Long A clue',
      shortClue: 'A',
      category: 'test',
      difficulty: 'easy',
    },
    {
      id: 'b',
      answer: 'BBBBB',
      answerLength: 5,
      clue: 'Long B clue',
      shortClue: 'B',
      category: 'test',
      difficulty: 'easy',
    },
  ];

  assert.throws(
    () =>
      generatePuzzleLayout(entries, {
        categories: ['test'],
        categoryWeight: 1,
        columnCount: 8,
        difficulty: 'easy',
        rowCount: 8,
        seed: 'disconnected-layout',
        targetWordCount: 2,
      }),
    /Could place only 1 of 2 requested words/,
  );
});
