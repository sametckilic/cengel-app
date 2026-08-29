const assert = require('node:assert/strict');
const test = require('node:test');

const {
  composeCatalogWithFallback,
} = require('../data/catalog-composition.ts');
const { isPuzzleManifest } = require('../../../packages/puzzle-core/src/puzzle-schema.ts');

const fallback = { id: 'prototype', source: 'bundled' };

test('accepts an empty generated manifest when a bundled fallback is available', () => {
  const manifest = require('../data/generated/puzzles.json');

  assert.equal(manifest.puzzles.length, 0);
  assert.equal(isPuzzleManifest(manifest), true);
});

test('adds the bundled fallback when the manifest does not contain it', () => {
  const catalog = composeCatalogWithFallback(fallback, [
    { id: 'daily', source: 'remote' },
  ]);

  assert.deepEqual(catalog, [fallback, { id: 'daily', source: 'remote' }]);
});

test('uses the manifest version instead of duplicating the fallback puzzle', () => {
  const remotePrototype = { id: 'prototype', source: 'remote' };
  const catalog = composeCatalogWithFallback(fallback, [
    { id: 'daily', source: 'remote' },
    remotePrototype,
  ]);

  assert.deepEqual(catalog, [remotePrototype, { id: 'daily', source: 'remote' }]);
});

test('still rejects duplicate ids inside a manifest', () => {
  assert.throws(
    () =>
      composeCatalogWithFallback(fallback, [
        { id: 'daily', source: 'remote' },
        { id: 'daily', source: 'remote-copy' },
      ]),
    /Duplicate puzzle id in shared catalog: "daily"/,
  );
});
