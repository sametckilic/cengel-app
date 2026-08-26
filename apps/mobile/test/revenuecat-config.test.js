const assert = require('node:assert/strict');
const test = require('node:test');

const { getRevenueCatApiKey } = require('../services/revenuecat-config.ts');
const {
  describePremiumPackage,
  isPurchaseCancelled,
} = require('../services/revenuecat-state.ts');
const {
  isAccountEntitlementsResponse,
  pollEntitlementState,
} = require('../services/entitlement-state.ts');

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

test('describes a dashboard package for the UI', () => {
  assert.deepEqual(
    describePremiumPackage({
      identifier: '$rc_monthly',
      product: {
        identifier: 'cengel_premium_monthly',
        priceString: '₺99,99',
        title: 'Çengel Premium',
      },
    }),
    {
      identifier: '$rc_monthly',
      price: '₺99,99',
      productId: 'cengel_premium_monthly',
      title: 'Çengel Premium',
    },
  );
});

test('recognizes only RevenueCat purchase cancellation errors as cancellation', () => {
  assert.equal(isPurchaseCancelled({ code: '1' }), true);
  assert.equal(isPurchaseCancelled({ code: '10' }), false);
  assert.equal(isPurchaseCancelled(new Error('cancelled')), false);
});

test('validates backend entitlement responses', () => {
  assert.equal(
    isAccountEntitlementsResponse({
      apiVersion: 1,
      items: [
        {
          active: true,
          entitlementId: 'premium_access',
          expiresAt: null,
          productId: 'premium_monthly',
        },
      ],
    }),
    true,
  );
  assert.equal(
    isAccountEntitlementsResponse({ apiVersion: 1, items: [{ active: 'yes' }] }),
    false,
  );
});

test('polls until the backend entitlement matches the SDK state', async () => {
  const states = [false, false, true];
  const delays = [];
  const synchronized = await pollEntitlementState({
    delaysMs: [0, 10, 20],
    expectedActive: true,
    readActive: async () => states.shift() ?? null,
    wait: async (delayMs) => {
      delays.push(delayMs);
    },
  });

  assert.equal(synchronized, true);
  assert.deepEqual(delays, [10, 20]);
});
