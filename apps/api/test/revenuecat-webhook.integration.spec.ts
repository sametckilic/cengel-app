import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { ApiEnvironment } from '../src/config/environment';
import type { DatabaseService } from '../src/database/database.service';
import * as schema from '../src/database/schema';
import { RevenueCatWebhookService } from '../src/subscriptions/revenuecat-webhook.service';

const AUTHORIZATION = 'Bearer integration-test-secret';
const SOURCE_USER_ID = '00000000-0000-4000-8000-000000000101';
const DESTINATION_USER_ID = '00000000-0000-4000-8000-000000000102';
const databaseUrl = process.env.TEST_DATABASE_URL;
const describeWithDatabase = databaseUrl ? describe : describe.skip;

function event(
  id: string,
  type: string,
  timestamp: number,
  overrides: Record<string, unknown> = {},
) {
  return {
    api_version: '1.0',
    event: {
      aliases: [],
      app_user_id: SOURCE_USER_ID,
      entitlement_ids: ['premium_access'],
      environment: 'SANDBOX',
      event_timestamp_ms: timestamp,
      expiration_at_ms: Date.parse('2026-10-01T00:00:00.000Z'),
      id,
      product_id: 'premium_monthly',
      type,
      ...overrides,
    },
  };
}

describeWithDatabase('RevenueCat webhook PostgreSQL integration', () => {
  let client: PoolClient;
  let pool: Pool;
  let service: RevenueCatWebhookService;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    client = await pool.connect();
    await client.query('BEGIN');

    const transactionDatabase = drizzle(client, { schema });
    const database = {
      db: {
        transaction: async <T>(
          callback: (transaction: NodePgDatabase<typeof schema>) => Promise<T>,
        ) => callback(transactionDatabase),
      },
    } as unknown as DatabaseService;
    const config = {
      get(key: keyof ApiEnvironment) {
        if (key === 'REVENUECAT_WEBHOOK_AUTHORIZATION') {
          return AUTHORIZATION;
        }
        if (key === 'REVENUECAT_ALLOWED_ENVIRONMENTS') {
          return ['SANDBOX'];
        }
        return undefined;
      },
    } as ConfigService<ApiEnvironment, true>;

    service = new RevenueCatWebhookService(database, config);
  });

  afterAll(async () => {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  });

  it('projects ordered lifecycle events and transfers idempotently', async () => {
    const initialTimestamp = Date.parse('2026-08-26T01:00:00.000Z');
    const initial = event('integration-event-001', 'INITIAL_PURCHASE', initialTimestamp);

    await expect(service.handle(AUTHORIZATION, initial)).resolves.toEqual({
      status: 'processed',
    });
    await expect(service.handle(AUTHORIZATION, initial)).resolves.toEqual({
      status: 'duplicate',
    });

    await service.handle(
      AUTHORIZATION,
      event('integration-event-002', 'CANCELLATION', initialTimestamp + 1_000),
    );
    await service.handle(
      AUTHORIZATION,
      event('integration-event-000', 'EXPIRATION', initialTimestamp - 1_000),
    );

    let entitlement = await client.query<{
      active: boolean;
      source_event_id: string;
    }>(
      'SELECT active, source_event_id FROM user_entitlements WHERE user_id = $1 AND entitlement_id = $2',
      [SOURCE_USER_ID, 'premium_access'],
    );
    expect(entitlement.rows[0]).toEqual({
      active: true,
      source_event_id: 'integration-event-001',
    });

    await service.handle(
      AUTHORIZATION,
      event('integration-event-003', 'RENEWAL', initialTimestamp + 2_000, {
        expiration_at_ms: Date.parse('2026-11-01T00:00:00.000Z'),
      }),
    );
    await service.handle(
      AUTHORIZATION,
      event('integration-event-004', 'TRANSFER', initialTimestamp + 3_000, {
        aliases: undefined,
        app_user_id: undefined,
        entitlement_ids: undefined,
        expiration_at_ms: undefined,
        product_id: undefined,
        transferred_from: [SOURCE_USER_ID],
        transferred_to: [DESTINATION_USER_ID],
      }),
    );

    const transferred = await client.query<{
      active: boolean;
      source_event_id: string;
      user_id: string;
    }>(
      'SELECT user_id, active, source_event_id FROM user_entitlements WHERE user_id = ANY($1::uuid[]) ORDER BY user_id',
      [[SOURCE_USER_ID, DESTINATION_USER_ID]],
    );
    expect(transferred.rows).toEqual([
      {
        active: false,
        source_event_id: 'integration-event-004',
        user_id: SOURCE_USER_ID,
      },
      {
        active: true,
        source_event_id: 'integration-event-004',
        user_id: DESTINATION_USER_ID,
      },
    ]);

    await service.handle(
      AUTHORIZATION,
      event('integration-event-005', 'EXPIRATION', initialTimestamp + 4_000, {
        app_user_id: DESTINATION_USER_ID,
      }),
    );
    entitlement = await client.query(
      'SELECT active, source_event_id FROM user_entitlements WHERE user_id = $1 AND entitlement_id = $2',
      [DESTINATION_USER_ID, 'premium_access'],
    );
    expect(entitlement.rows[0]).toEqual({
      active: false,
      source_event_id: 'integration-event-005',
    });
  });

  it('rejects a production event in the sandbox environment', async () => {
    await expect(
      service.handle(
        AUTHORIZATION,
        event('integration-event-production', 'INITIAL_PURCHASE', Date.now(), {
          environment: 'PRODUCTION',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
