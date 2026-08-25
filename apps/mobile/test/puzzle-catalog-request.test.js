const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createPuzzleCatalogRequestHeaders,
} = require('../services/puzzle-catalog-request.ts');

test('creates an anonymous conditional catalog request', () => {
  assert.deepEqual(createPuzzleCatalogRequestHeaders('"catalog-etag"'), {
    Accept: 'application/json',
    'If-None-Match': '"catalog-etag"',
  });
});

test('adds the account bearer token for entitlement-aware catalog requests', () => {
  assert.deepEqual(createPuzzleCatalogRequestHeaders(undefined, 'access-token'), {
    Accept: 'application/json',
    Authorization: 'Bearer access-token',
  });
});
