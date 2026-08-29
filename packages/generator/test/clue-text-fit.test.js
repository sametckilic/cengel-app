const assert = require('node:assert/strict');
const test = require('node:test');

const {
  analyzeClueTextFit,
  measureClueTextUnits,
  resolveClueTextPolicy,
} = require('../src/clue-text-fit');

test('measures whitespace, punctuation, narrow and wide characters proportionally', () => {
  assert.equal(measureClueTextUnits('  İri   iş!  '), 4.55);
  assert.ok(measureClueTextUnits('WWW') > measureClueTextUnits('iii'));
});

test('uses a stricter text budget for split clue cells', () => {
  const clue = 'Oldukça uzun açıklama metni';
  const single = analyzeClueTextFit(clue, false);
  const split = analyzeClueTextFit(clue, true);

  assert.equal(single.fits, true);
  assert.equal(split.fits, false);
  assert.equal(single.maximumUnits, 24);
  assert.equal(split.maximumUnits, 23);
});

test('rejects invalid clue text policy overrides', () => {
  assert.throws(
    () => resolveClueTextPolicy({ maximumSplitClueUnits: 25 }),
    /cannot be greater/,
  );
  assert.throws(
    () => resolveClueTextPolicy({ maximumSingleClueUnits: 0 }),
    /positive number/,
  );
});
