const assert = require('node:assert/strict');
const test = require('node:test');

const {
  clampGridTranslation,
  getGridTranslationLimit,
  getPinchAnchoredTranslation,
} = require('../utils/puzzle-grid-viewport.ts');

test('prevents panning while the scaled grid fits its viewport', () => {
  assert.equal(getGridTranslationLimit(388, 388, 0.65), 0);
  assert.equal(getGridTranslationLimit(388, 388, 1), 0);
});

test('limits panning to the actual scaled overflow', () => {
  assert.equal(getGridTranslationLimit(388, 388, 2.5), 291);
  assert.equal(clampGridTranslation(340, 291), 291);
  assert.equal(clampGridTranslation(-340, 291), -291);
});

test('keeps the content under a stationary off-center pinch focal point', () => {
  assert.equal(
    getPinchAnchoredTranslation(0, 300, 300, 200, 1, 2),
    -100,
  );
});

test('follows a moving pinch focal point without adding pan translation twice', () => {
  assert.equal(
    getPinchAnchoredTranslation(20, 260, 280, 200, 1, 1.5),
    20,
  );
});
