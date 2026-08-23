const assert = require('node:assert/strict');
const test = require('node:test');

const puzzle = require('../apps/mobile/data/generated/newspaper-prototype-8x8.json');
const {
  prototypeAnswerRevealAccessProvider,
} = require('../apps/mobile/services/hint-access.ts');
const {
  backspacePuzzleEntry,
  beginPuzzleWordEntry,
  enterPuzzleLetter,
  normalizePuzzleLetter,
} = require('../apps/mobile/utils/puzzle-input.ts');
const { revealSelectedWord } = require('../apps/mobile/utils/puzzle-hint.ts');
const {
  createInitialPuzzleSelection,
  getSelectedWord,
  getWordsAtCell,
  selectPuzzleCell,
} = require('../apps/mobile/utils/puzzle-selection.ts');
const {
  getLockedCellIndices,
  getLockedWordPattern,
  isPuzzleComplete,
  validateSelectedWord,
} = require('../apps/mobile/utils/puzzle-validation.ts');

test('keeps the active word while moving within it', () => {
  const initialSelection = createInitialPuzzleSelection(puzzle);
  const initialWord = getSelectedWord(puzzle, initialSelection);
  const nextCellIndex = initialWord.cellIndices[1];
  const selection = selectPuzzleCell(puzzle, initialSelection, nextCellIndex);

  assert.equal(selection.cellIndex, nextCellIndex);
  assert.equal(selection.wordId, initialSelection.wordId);
});

test('selects a word when a letter belongs to only one answer', () => {
  const initialSelection = createInitialPuzzleSelection(puzzle);
  const cellIndex = puzzle.cells.findIndex(
    (cell, index) => cell.type === 'letter' && getWordsAtCell(puzzle, index).length === 1,
  );
  const [onlyWord] = getWordsAtCell(puzzle, cellIndex);
  const selection = selectPuzzleCell(puzzle, initialSelection, cellIndex);

  assert.equal(selection.cellIndex, cellIndex);
  assert.equal(getSelectedWord(puzzle, selection).id, onlyWord.id);
});

test('changes direction when the selected intersection is pressed again', () => {
  const initialSelection = createInitialPuzzleSelection(puzzle);
  const cellIndex = puzzle.cells.findIndex(
    (cell, index) => cell.type === 'letter' && getWordsAtCell(puzzle, index).length === 2,
  );
  const firstSelection = selectPuzzleCell(puzzle, initialSelection, cellIndex);
  const secondSelection = selectPuzzleCell(puzzle, firstSelection, cellIndex);

  assert.equal(getWordsAtCell(puzzle, cellIndex).length, 2);
  assert.notEqual(
    getSelectedWord(puzzle, firstSelection).direction,
    getSelectedWord(puzzle, secondSelection).direction,
  );
});

test('preserves direction when moving directly to another intersection', () => {
  const word = puzzle.words.find(
    ({ cellIndices }) =>
      cellIndices.filter((cellIndex) => getWordsAtCell(puzzle, cellIndex).length === 2)
        .length >= 2,
  );
  const [firstCellIndex, nextCellIndex] = word.cellIndices.filter(
    (cellIndex) => getWordsAtCell(puzzle, cellIndex).length === 2,
  );
  const selection = { cellIndex: firstCellIndex, wordId: word.id };
  const nextSelection = selectPuzzleCell(puzzle, selection, nextCellIndex);

  assert.equal(getSelectedWord(puzzle, nextSelection).id, word.id);
});

test('ignores clue cells', () => {
  const initialSelection = createInitialPuzzleSelection(puzzle);

  assert.equal(getWordsAtCell(puzzle, 0).length, 0);
  assert.equal(selectPuzzleCell(puzzle, initialSelection, 0), initialSelection);
});

test('normalizes Turkish letters and advances inside the active word', () => {
  const state = {
    entries: {},
    selection: createInitialPuzzleSelection(puzzle),
  };
  const nextState = enterPuzzleLetter(puzzle, state, 'i');
  const word = getSelectedWord(puzzle, state.selection);

  assert.equal(normalizePuzzleLetter('ğ'), 'Ğ');
  assert.equal(nextState.entries[word.cellIndices[0]], 'İ');
  assert.equal(nextState.selection.cellIndex, word.cellIndices[1]);
  assert.equal(nextState.selection.wordId, state.selection.wordId);
});

test('starts a newly tapped answer at its first editable cell', () => {
  const initialSelection = createInitialPuzzleSelection(puzzle);
  const word = getSelectedWord(puzzle, initialSelection);
  const tappedCellIndex = word.cellIndices.at(-1);
  const state = {
    entries: {},
    selection: { ...initialSelection, cellIndex: tappedCellIndex },
  };
  const entryState = beginPuzzleWordEntry(puzzle, state);
  const nextState = enterPuzzleLetter(puzzle, entryState, 'a');

  assert.equal(nextState.entries[word.cellIndices[0]], 'A');
  assert.equal(nextState.entries[tappedCellIndex], undefined);
  assert.equal(nextState.selection.cellIndex, word.cellIndices[1]);
});

test('skips a locked letter when starting an answer from the beginning', () => {
  const initialSelection = createInitialPuzzleSelection(puzzle);
  const word = getSelectedWord(puzzle, initialSelection);
  const firstCellIndex = word.cellIndices[0];
  const secondCellIndex = word.cellIndices[1];
  const state = {
    entries: { [firstCellIndex]: word.answer[0] },
    selection: { ...initialSelection, cellIndex: word.cellIndices.at(-1) },
  };
  const lockedCellIndices = new Set([firstCellIndex]);
  const entryState = beginPuzzleWordEntry(puzzle, state, lockedCellIndices);
  const nextState = enterPuzzleLetter(puzzle, entryState, 'a', lockedCellIndices);

  assert.equal(nextState.entries[firstCellIndex], word.answer[0]);
  assert.equal(nextState.entries[secondCellIndex], 'A');
});

test('stays on the final cell after entering a letter', () => {
  const initialSelection = createInitialPuzzleSelection(puzzle);
  const word = getSelectedWord(puzzle, initialSelection);
  const finalCellIndex = word.cellIndices[word.cellIndices.length - 1];
  const state = {
    entries: {},
    selection: { ...initialSelection, cellIndex: finalCellIndex },
  };
  const nextState = enterPuzzleLetter(puzzle, state, 'ç');

  assert.equal(nextState.entries[finalCellIndex], 'Ç');
  assert.equal(nextState.selection.cellIndex, finalCellIndex);
});

test('backspace clears the active value before moving backward', () => {
  const selection = createInitialPuzzleSelection(puzzle);
  const filledState = {
    entries: { [selection.cellIndex]: 'İ' },
    selection,
  };
  const clearedState = backspacePuzzleEntry(puzzle, filledState);

  assert.equal(clearedState.entries[selection.cellIndex], undefined);
  assert.deepEqual(clearedState.selection, selection);

  const advancedState = enterPuzzleLetter(puzzle, filledState, 'i');
  const movedBackState = backspacePuzzleEntry(puzzle, advancedState);

  assert.equal(movedBackState.entries[selection.cellIndex], undefined);
  assert.equal(movedBackState.selection.cellIndex, selection.cellIndex);
});

test('rejects unsupported input characters', () => {
  assert.throws(() => normalizePuzzleLetter('1'), /Unsupported puzzle letter/);
  assert.throws(() => normalizePuzzleLetter('AB'), /Unsupported puzzle letter/);
});

test('distinguishes Turkish dotted and dotless I during answer validation', () => {
  const word = {
    id: 'discount',
    answer: 'İSKONTO',
    cellIndices: [1, 2, 3, 4, 5, 6, 7],
  };
  const selection = { cellIndex: 1, wordId: word.id };
  const entriesWithDottedI = Object.fromEntries(
    word.cellIndices.map((cellIndex, index) => [cellIndex, word.answer[index]]),
  );
  const entriesWithDotlessI = { ...entriesWithDottedI, 1: 'I' };

  assert.equal(normalizePuzzleLetter('i'), 'İ');
  assert.equal(normalizePuzzleLetter('ı'), 'I');
  assert.equal(validateSelectedWord({ words: [word] }, entriesWithDottedI, selection).status, 'correct');
  assert.equal(validateSelectedWord({ words: [word] }, entriesWithDotlessI, selection).status, 'incorrect');
});

test('validates only after an explicit whole-word check', () => {
  const selection = createInitialPuzzleSelection(puzzle);
  const word = getSelectedWord(puzzle, selection);
  const correctEntries = Object.fromEntries(
    word.cellIndices.map((cellIndex, letterIndex) => [cellIndex, word.answer[letterIndex]]),
  );
  const partialEntries = Object.fromEntries(Object.entries(correctEntries).slice(0, 2));
  const finalCellIndex = word.cellIndices[word.cellIndices.length - 1];
  const wrongFinalLetter = word.answer.at(-1) === 'A' ? 'B' : 'A';
  const wrongEntries = { ...correctEntries, [finalCellIndex]: wrongFinalLetter };

  assert.deepEqual(validateSelectedWord(puzzle, partialEntries, selection), {
    status: 'incomplete',
    wordId: selection.wordId,
  });
  assert.deepEqual(validateSelectedWord(puzzle, wrongEntries, selection), {
    status: 'incorrect',
    wordId: selection.wordId,
  });
  assert.deepEqual(validateSelectedWord(puzzle, correctEntries, selection), {
    status: 'correct',
    wordId: selection.wordId,
  });
});

test('locked correct-word cells cannot be overwritten or erased', () => {
  const selection = createInitialPuzzleSelection(puzzle);
  const word = getSelectedWord(puzzle, selection);
  const solvedWordIds = new Set([selection.wordId]);
  const lockedCellIndices = getLockedCellIndices(puzzle, solvedWordIds);
  const state = {
    entries: Object.fromEntries(
      word.cellIndices.map((cellIndex, letterIndex) => [cellIndex, word.answer[letterIndex]]),
    ),
    selection,
  };

  assert.equal(lockedCellIndices.size, word.answer.length);
  assert.equal(enterPuzzleLetter(puzzle, state, 'A', lockedCellIndices), state);
  assert.equal(backspacePuzzleEntry(puzzle, state, lockedCellIndices), state);
});

test('input skips a locked intersection while solving its crossing word', () => {
  const downWord = puzzle.words.find(
    ({ direction, cellIndices }) => direction === 'down' && cellIndices.includes(15),
  );
  const crossingWord = puzzle.words.find(
    ({ direction, cellIndices }) => direction === 'right' && cellIndices.includes(15),
  );
  const lockedCellIndices = new Set([15]);
  const lockedLetter = crossingWord.answer[crossingWord.cellIndices.indexOf(15)];
  const state = {
    entries: { 15: lockedLetter },
    selection: { cellIndex: 15, wordId: downWord.id },
  };
  const nextState = enterPuzzleLetter(puzzle, state, 'A', lockedCellIndices);

  assert.equal(nextState.entries[15], lockedLetter);
  assert.equal(nextState.entries[23], 'A');
  assert.equal(nextState.selection.cellIndex, 31);
});

test('answer pattern exposes only genuinely locked letters', () => {
  const selection = createInitialPuzzleSelection(puzzle);
  const word = getSelectedWord(puzzle, selection);
  const entries = { [word.cellIndices[0]]: 'X', [word.cellIndices[2]]: 'G' };

  assert.deepEqual(
    getLockedWordPattern(word, entries, new Set([word.cellIndices[2]])),
    word.cellIndices.map((_, index) => (index === 2 ? 'G' : undefined)),
  );
});

test('reports completion only when every puzzle word is solved', () => {
  const allWordIds = new Set(puzzle.words.map(({ id }) => id));
  const incompleteWordIds = new Set([...allWordIds].slice(0, -1));

  assert.equal(isPuzzleComplete(puzzle, incompleteWordIds), false);
  assert.equal(isPuzzleComplete(puzzle, allWordIds), true);
});

test('reveals the selected answer only after hint access is granted', async () => {
  const selection = createInitialPuzzleSelection(puzzle);
  const access = await prototypeAnswerRevealAccessProvider.requestAccess({
    puzzleId: puzzle.id,
    wordId: selection.wordId,
  });

  assert.deepEqual(access, { granted: true, source: 'prototype' });

  const result = revealSelectedWord(puzzle, {
    entries: { 63: 'Z' },
    selection,
  });
  const selectedWord = getSelectedWord(puzzle, selection);

  assert.equal(result.wordId, selection.wordId);
  assert.equal(result.inputState.entries[63], 'Z');
  assert.equal(
    selectedWord.cellIndices.map((cellIndex) => result.inputState.entries[cellIndex]).join(''),
    selectedWord.answer,
  );
});
