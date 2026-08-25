import { describe, expect, it } from 'vitest';

import {
  createEntitlementMutation,
  parseRevenueCatEvent,
  resolveRevenueCatUserId,
} from '../src/subscriptions/revenuecat-event';
import { isExpectedAuthorization } from '../src/subscriptions/revenuecat-webhook.service';

const USER_ID = '00000000-0000-4000-8000-000000000001';

function createEvent(overrides: Record<string, unknown> = {}) {
  return parseRevenueCatEvent({
    api_version: '1.0',
    event: {
      aliases: [],
      app_user_id: USER_ID,
      entitlement_ids: ['premium_access'],
      environment: 'SANDBOX',
      event_timestamp_ms: 1_777_000_000_000,
      expiration_at_ms: 1_779_000_000_000,
      id: 'event-1',
      product_id: 'premium_monthly',
      type: 'INITIAL_PURCHASE',
      ...overrides,
    },
  });
}

describe('RevenueCat webhook events', () => {
  it('uses a Supabase UUID alias when RevenueCat reports an anonymous user id', () => {
    const event = createEvent({
      aliases: ['$RCAnonymousID:device', USER_ID],
      app_user_id: '$RCAnonymousID:device',
    });

    expect(resolveRevenueCatUserId(event)).toBe(USER_ID);
  });

  it('activates every entitlement from a purchase event', () => {
    const mutation = createEntitlementMutation(
      createEvent({ entitlement_ids: ['premium_access', 'archive_access'] }),
    );

    expect(mutation).toEqual({
      active: true,
      entitlementIds: ['premium_access', 'archive_access'],
      expiresAt: new Date(1_779_000_000_000),
      userId: USER_ID,
    });
  });

  it('deactivates an entitlement on expiration', () => {
    expect(createEntitlementMutation(createEvent({ type: 'EXPIRATION' }))).toMatchObject({
      active: false,
      entitlementIds: ['premium_access'],
      userId: USER_ID,
    });
  });

  it('does not revoke access early for cancellation notifications', () => {
    expect(createEntitlementMutation(createEvent({ type: 'CANCELLATION' }))).toBeNull();
  });

  it('supports the deprecated singular entitlement field', () => {
    expect(
      createEntitlementMutation(
        createEvent({ entitlement_id: 'premium_access', entitlement_ids: null }),
      ),
    ).toMatchObject({ entitlementIds: ['premium_access'] });
  });

  it('compares the configured authorization header exactly', () => {
    expect(isExpectedAuthorization('Bearer correct-secret', 'Bearer correct-secret')).toBe(
      true,
    );
    expect(isExpectedAuthorization('Bearer wrong-secret', 'Bearer correct-secret')).toBe(
      false,
    );
    expect(isExpectedAuthorization(undefined, 'Bearer correct-secret')).toBe(false);
  });
});
