import { timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, inArray, lt, or } from 'drizzle-orm';

import type { ApiEnvironment } from '../config/environment';
import { DatabaseService } from '../database/database.service';
import {
  subscriptionEvents,
  userEntitlements,
} from '../database/schema';
import {
  createEntitlementTransfer,
  createEntitlementMutation,
  parseRevenueCatEvent,
  resolveRevenueCatUserId,
} from './revenuecat-event';

export type RevenueCatWebhookResult = {
  status: 'duplicate' | 'processed';
};

function isOlderThanIncomingEvent(eventId: string, eventTimestamp: Date) {
  return or(
    lt(userEntitlements.sourceEventTimestamp, eventTimestamp),
    and(
      eq(userEntitlements.sourceEventTimestamp, eventTimestamp),
      lt(userEntitlements.sourceEventId, eventId),
    ),
  )!;
}

export function isExpectedAuthorization(
  actual: string | undefined,
  expected: string,
): boolean {
  if (!actual) {
    return false;
  }

  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);

  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

@Injectable()
export class RevenueCatWebhookService {
  constructor(
    private readonly database: DatabaseService,
    private readonly config: ConfigService<ApiEnvironment, true>,
  ) {}

  async handle(
    authorization: string | undefined,
    body: unknown,
  ): Promise<RevenueCatWebhookResult> {
    const expectedAuthorization = this.config.get(
      'REVENUECAT_WEBHOOK_AUTHORIZATION',
      { infer: true },
    );

    if (!expectedAuthorization) {
      throw new ServiceUnavailableException('RevenueCat webhook is not configured.');
    }

    if (!isExpectedAuthorization(authorization, expectedAuthorization)) {
      throw new UnauthorizedException('Invalid RevenueCat webhook authorization.');
    }

    let event;

    try {
      event = parseRevenueCatEvent(body);
    } catch {
      throw new BadRequestException('Invalid RevenueCat webhook payload.');
    }
    const eventTimestamp = new Date(event.event_timestamp_ms);
    const mutation = createEntitlementMutation(event);
    const transfer = createEntitlementTransfer(event);
    const eventEnvironment = event.environment?.toUpperCase();
    const allowedEnvironments = this.config.get(
      'REVENUECAT_ALLOWED_ENVIRONMENTS',
      { infer: true },
    );

    if (
      eventEnvironment &&
      !allowedEnvironments.includes(eventEnvironment)
    ) {
      throw new BadRequestException(
        `RevenueCat environment "${event.environment}" is not allowed.`,
      );
    }

    if (mutation && !event.environment) {
      throw new BadRequestException(
        'RevenueCat lifecycle events must include an environment.',
      );
    }

    return this.database.db.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(subscriptionEvents)
        .values({
          appUserId:
            resolveRevenueCatUserId(event) ?? transfer?.toUserIds[0] ?? null,
          environment: eventEnvironment,
          eventId: event.id,
          eventTimestamp,
          eventType: event.type,
          payload: body as Record<string, unknown>,
        })
        .onConflictDoNothing()
        .returning({ eventId: subscriptionEvents.eventId });

      if (inserted.length === 0) {
        return { status: 'duplicate' };
      }

      if (mutation) {
        for (const entitlementId of mutation.entitlementIds) {
          await transaction
            .insert(userEntitlements)
            .values({
              active: mutation.active,
              entitlementId,
              environment: eventEnvironment,
              expiresAt: mutation.expiresAt,
              productId: event.product_id,
              revokedAt: mutation.active ? null : eventTimestamp,
              sourceEventId: event.id,
              sourceEventTimestamp: eventTimestamp,
              userId: mutation.userId,
            })
            .onConflictDoUpdate({
              set: {
                active: mutation.active,
                environment: eventEnvironment,
                expiresAt: mutation.expiresAt,
                productId: event.product_id,
                revokedAt: mutation.active ? null : eventTimestamp,
                sourceEventId: event.id,
                sourceEventTimestamp: eventTimestamp,
                updatedAt: new Date(),
              },
              setWhere: isOlderThanIncomingEvent(event.id, eventTimestamp),
              target: [userEntitlements.userId, userEntitlements.entitlementId],
            });
        }
      }

      if (transfer) {
        const sourceEntitlements = await transaction
          .select({
            active: userEntitlements.active,
            entitlementId: userEntitlements.entitlementId,
            environment: userEntitlements.environment,
            expiresAt: userEntitlements.expiresAt,
            productId: userEntitlements.productId,
          })
          .from(userEntitlements)
          .where(
            and(
              inArray(userEntitlements.userId, transfer.fromUserIds),
              isOlderThanIncomingEvent(event.id, eventTimestamp),
            ),
          );
        const activeEntitlements = sourceEntitlements
          .filter(
            (entitlement) =>
              entitlement.active &&
              (!entitlement.expiresAt || entitlement.expiresAt > eventTimestamp),
          )
          .sort((left, right) => {
            if (!left.expiresAt) return -1;
            if (!right.expiresAt) return 1;
            return right.expiresAt.getTime() - left.expiresAt.getTime();
          })
          .filter(
            (entitlement, index, entitlements) =>
              entitlements.findIndex(
                (candidate) =>
                  candidate.entitlementId === entitlement.entitlementId,
              ) === index,
          );

        await transaction
          .update(userEntitlements)
          .set({
            active: false,
            revokedAt: eventTimestamp,
            sourceEventId: event.id,
            sourceEventTimestamp: eventTimestamp,
            updatedAt: new Date(),
          })
          .where(
            and(
              inArray(userEntitlements.userId, transfer.fromUserIds),
              isOlderThanIncomingEvent(event.id, eventTimestamp),
            ),
          );

        for (const userId of transfer.toUserIds) {
          for (const entitlement of activeEntitlements) {
            await transaction
              .insert(userEntitlements)
              .values({
                active: true,
                entitlementId: entitlement.entitlementId,
                environment: eventEnvironment ?? entitlement.environment,
                expiresAt: entitlement.expiresAt,
                productId: entitlement.productId,
                revokedAt: null,
                sourceEventId: event.id,
                sourceEventTimestamp: eventTimestamp,
                userId,
              })
              .onConflictDoUpdate({
                set: {
                  active: true,
                  environment: eventEnvironment ?? entitlement.environment,
                  expiresAt: entitlement.expiresAt,
                  productId: entitlement.productId,
                  revokedAt: null,
                  sourceEventId: event.id,
                  sourceEventTimestamp: eventTimestamp,
                  updatedAt: new Date(),
                },
                setWhere: isOlderThanIncomingEvent(event.id, eventTimestamp),
                target: [
                  userEntitlements.userId,
                  userEntitlements.entitlementId,
                ],
              });
          }
        }
      }

      return { status: 'processed' };
    });
  }
}
