const assert = require('node:assert/strict');
const test = require('node:test');

const { getRevenueCatApiKey } = require('../services/revenuecat-config.ts');

test('uses the Test Store key only in development native builds', () => {
  assert.equal(
    getRevenueCatApiKey({
      androidKey: 'goog_release',
      iosKey: 'appl_release',
      isDevelopment: true,
      platform: 'android',
      testStoreKey: 'test_development',
    }),
    'test_development',
  );
});

test('uses platform keys for release builds', () => {
  assert.equal(
    getRevenueCatApiKey({
      androidKey: 'goog_release',
      iosKey: 'appl_release',
      isDevelopment: false,
      platform: 'ios',
      testStoreKey: 'test_development',
    }),
    'appl_release',
  );
});

test('keeps RevenueCat disabled on web', () => {
  assert.equal(
    getRevenueCatApiKey({
      isDevelopment: true,
      platform: 'web',
      testStoreKey: 'test_development',
    }),
    null,
  );
});
