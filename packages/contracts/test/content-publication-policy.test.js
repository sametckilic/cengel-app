import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CONTENT_PUBLICATION_POLICY,
  PREMIUM_ACCESS_ENTITLEMENT,
  resolveRequiredEntitlement,
} from '../src/content-publication-policy.ts';

test('daily puzzles are free', () => {
  assert.equal(resolveRequiredEntitlement({ channel: 'daily' }), null);
});

test('archive puzzles require premium access', () => {
  assert.equal(
    resolveRequiredEntitlement({ channel: 'archive' }),
    PREMIUM_ACCESS_ENTITLEMENT,
  );
});

test('only the first puzzle in a pack is free', () => {
  assert.equal(
    resolveRequiredEntitlement({ channel: 'pack', puzzleNumber: 1 }),
    null,
  );
  assert.equal(
    resolveRequiredEntitlement({ channel: 'pack', puzzleNumber: 2 }),
    PREMIUM_ACCESS_ENTITLEMENT,
  );
  assert.equal(
    resolveRequiredEntitlement({ channel: 'pack', puzzleNumber: 12 }),
    PREMIUM_ACCESS_ENTITLEMENT,
  );
});

test('pack puzzle numbers are one-based positive integers', () => {
  assert.throws(
    () => resolveRequiredEntitlement({ channel: 'pack', puzzleNumber: 0 }),
    /positive integer/,
  );
  assert.throws(
    () => resolveRequiredEntitlement({ channel: 'pack', puzzleNumber: 1.5 }),
    /positive integer/,
  );
});

test('downloaded access is retained only for the same local profile', () => {
  assert.deepEqual(CONTENT_PUBLICATION_POLICY.downloadedPuzzleAccess, {
    mode: 'retain',
    scope: 'local-profile',
  });
});
