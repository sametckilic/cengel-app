import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { userEntitlements } from '../database/schema';

type EntitlementRow = {
  active: boolean;
  entitlementId: string;
  expiresAt: Date | null;
  productId: string | null;
};

const DEFAULT_ENTITLEMENTS = ['premium_access'] as const;

export function createEntitlementList(
  rows: readonly EntitlementRow[],
  now = new Date(),
) {
  const rowsById = new Map(rows.map((row) => [row.entitlementId, row]));
  const ids = [
    ...DEFAULT_ENTITLEMENTS,
    ...rows.map(({ entitlementId }) => entitlementId),
  ].filter((value, index, values) => values.indexOf(value) === index);

  return {
    apiVersion: 1 as const,
    items: ids.map((entitlementId) => {
      const row = rowsById.get(entitlementId);
      const active = Boolean(
        row?.active && (!row.expiresAt || row.expiresAt.getTime() > now.getTime()),
      );

      return {
        active,
        entitlementId,
        expiresAt: row?.expiresAt?.toISOString() ?? null,
        productId: row?.productId ?? null,
      };
    }),
  };
}

@Injectable()
export class EntitlementsService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string) {
    const rows = await this.database.db
      .select({
        active: userEntitlements.active,
        entitlementId: userEntitlements.entitlementId,
        expiresAt: userEntitlements.expiresAt,
        productId: userEntitlements.productId,
      })
      .from(userEntitlements)
      .where(eq(userEntitlements.userId, userId));

    return createEntitlementList(rows);
  }
}
