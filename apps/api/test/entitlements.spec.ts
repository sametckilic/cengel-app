import { describe, expect, it } from 'vitest';

import { createEntitlementList } from '../src/subscriptions/entitlements.service';

describe('entitlements', () => {
  it('returns premium access as inactive before a purchase', () => {
    expect(createEntitlementList([]).items).toEqual([
      {
        active: false,
        entitlementId: 'premium_access',
        expiresAt: null,
        productId: null,
      },
    ]);
  });

  it('treats a non-expired entitlement as active', () => {
    const result = createEntitlementList(
      [
        {
          active: true,
          entitlementId: 'premium_access',
          expiresAt: new Date('2026-09-01T00:00:00.000Z'),
          productId: 'premium_monthly',
        },
      ],
      new Date('2026-08-25T00:00:00.000Z'),
    );

    expect(result.items[0]).toMatchObject({
      active: true,
      expiresAt: '2026-09-01T00:00:00.000Z',
    });
  });

  it('treats an expired entitlement as inactive even when its stored flag is active', () => {
    const result = createEntitlementList(
      [
        {
          active: true,
          entitlementId: 'premium_access',
          expiresAt: new Date('2026-08-24T00:00:00.000Z'),
          productId: 'premium_monthly',
        },
      ],
      new Date('2026-08-25T00:00:00.000Z'),
    );

    expect(result.items[0]?.active).toBe(false);
  });

  it('keeps lifetime entitlements active without an expiration date', () => {
    const result = createEntitlementList([
      {
        active: true,
        entitlementId: 'premium_access',
        expiresAt: null,
        productId: 'premium_lifetime',
      },
    ]);

    expect(result.items[0]?.active).toBe(true);
  });
});
