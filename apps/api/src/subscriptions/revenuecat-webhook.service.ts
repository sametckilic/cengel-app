import { timingSafeEqual } from 'node:crypto';

import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lte } from 'drizzle-orm';

import type { ApiEnvironment } from '../config/environment';
import { DatabaseService } from '../database/database.service';
import {
  subscriptionEvents,
  userEntitlements,
} from '../database/schema';
import {
  createEntitlementMutation,
  parseRevenueCatEvent,
} from './revenuecat-event';

export type RevenueCatWebhookResult = {
  status: 'duplicate' | 'processed';
};

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

    return this.database.db.transaction(async (transaction) => {
      const inserted = await transaction
        .insert(subscriptionEvents)
        .values({
          appUserId: event.app_user_id,
          environment: event.environment,
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
              environment: event.environment,
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
                environment: event.environment,
                expiresAt: mutation.expiresAt,
                productId: event.product_id,
                revokedAt: mutation.active ? null : eventTimestamp,
                sourceEventId: event.id,
                sourceEventTimestamp: eventTimestamp,
                updatedAt: new Date(),
              },
              setWhere: lte(userEntitlements.sourceEventTimestamp, eventTimestamp),
              target: [userEntitlements.userId, userEntitlements.entitlementId],
            });
        }
      }

      return { status: 'processed' };
    });
  }
}
