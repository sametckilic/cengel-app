import { z } from 'zod';

const revenueCatEventSchema = z
  .object({
    aliases: z.array(z.string()).optional().default([]),
    app_user_id: z.string().optional(),
    entitlement_id: z.string().nullable().optional(),
    entitlement_ids: z.array(z.string()).nullable().optional(),
    environment: z.string().optional(),
    event_timestamp_ms: z.number().int().nonnegative(),
    expiration_at_ms: z.number().int().nonnegative().nullable().optional(),
    id: z.string().min(1),
    original_app_user_id: z.string().optional(),
    product_id: z.string().optional(),
    transferred_from: z.array(z.string()).optional(),
    transferred_to: z.array(z.string()).optional(),
    type: z.string().min(1),
  })
  .loose();

const revenueCatEnvelopeSchema = z
  .object({
    api_version: z.string().min(1),
    event: revenueCatEventSchema,
  })
  .loose();

export type RevenueCatEvent = z.infer<typeof revenueCatEventSchema>;

export type EntitlementMutation = {
  active: boolean;
  entitlementIds: string[];
  expiresAt: Date | null;
  userId: string;
};

export type EntitlementTransfer = {
  fromUserIds: string[];
  toUserIds: string[];
};

const ACTIVATING_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'NON_RENEWING_PURCHASE',
  'PRODUCT_CHANGE',
  'PURCHASE_REDEEMED',
  'REFUND_REVERSED',
  'RENEWAL',
  'SUBSCRIPTION_EXTENDED',
  'UNCANCELLATION',
]);

const uuidSchema = z.uuid();

function asUuid(value: string | undefined): string | null {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseRevenueCatEvent(body: unknown): RevenueCatEvent {
  return revenueCatEnvelopeSchema.parse(body).event;
}

export function resolveRevenueCatUserId(event: RevenueCatEvent): string | null {
  const candidates = [
    event.app_user_id,
    ...event.aliases,
    event.original_app_user_id,
  ];

  for (const candidate of candidates) {
    const userId = asUuid(candidate);
    if (userId) {
      return userId;
    }
  }

  return null;
}

function uniqueUuidValues(values: readonly string[]): string[] {
  return values.flatMap((value) => {
    const userId = asUuid(value);
    return userId ? [userId] : [];
  }).filter((value, index, candidates) => candidates.indexOf(value) === index);
}

export function createEntitlementTransfer(
  event: RevenueCatEvent,
): EntitlementTransfer | null {
  if (event.type !== 'TRANSFER') {
    return null;
  }

  const fromUserIds = uniqueUuidValues(event.transferred_from ?? []);
  const toUserIds = uniqueUuidValues(event.transferred_to ?? []).filter(
    (userId) => !fromUserIds.includes(userId),
  );

  return fromUserIds.length > 0 && toUserIds.length > 0
    ? { fromUserIds, toUserIds }
    : null;
}

export function getEventEntitlementIds(event: RevenueCatEvent): string[] {
  return [
    ...(event.entitlement_ids ?? []),
    ...(event.entitlement_id ? [event.entitlement_id] : []),
  ].filter((value, index, values) => values.indexOf(value) === index);
}

export function createEntitlementMutation(
  event: RevenueCatEvent,
): EntitlementMutation | null {
  const active = ACTIVATING_EVENTS.has(event.type)
    ? true
    : event.type === 'EXPIRATION'
      ? false
      : null;
  const userId = resolveRevenueCatUserId(event);
  const entitlementIds = getEventEntitlementIds(event);

  if (active === null || !userId || entitlementIds.length === 0) {
    return null;
  }

  return {
    active,
    entitlementIds,
    expiresAt:
      event.expiration_at_ms === null || event.expiration_at_ms === undefined
        ? null
        : new Date(event.expiration_at_ms),
    userId,
  };
}
