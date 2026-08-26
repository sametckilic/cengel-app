export type AccountEntitlement = {
  active: boolean;
  entitlementId: string;
  expiresAt: string | null;
  productId: string | null;
};

export type AccountEntitlementsResponse = {
  apiVersion: 1;
  items: AccountEntitlement[];
};

export function isAccountEntitlementsResponse(
  value: unknown,
): value is AccountEntitlementsResponse {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('apiVersion' in value) ||
    value.apiVersion !== 1 ||
    !('items' in value) ||
    !Array.isArray(value.items)
  ) {
    return false;
  }

  return value.items.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      'active' in item &&
      typeof item.active === 'boolean' &&
      'entitlementId' in item &&
      typeof item.entitlementId === 'string' &&
      'expiresAt' in item &&
      (item.expiresAt === null || typeof item.expiresAt === 'string') &&
      'productId' in item &&
      (item.productId === null || typeof item.productId === 'string'),
  );
}

type PollEntitlementOptions = {
  delaysMs?: readonly number[];
  expectedActive: boolean;
  readActive(): Promise<boolean | null>;
  wait?(delayMs: number): Promise<void>;
};

const DEFAULT_DELAYS_MS = [0, 500, 1_000, 2_000, 4_000] as const;

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

export async function pollEntitlementState({
  delaysMs = DEFAULT_DELAYS_MS,
  expectedActive,
  readActive,
  wait: waitForDelay = wait,
}: PollEntitlementOptions): Promise<boolean> {
  for (const delayMs of delaysMs) {
    if (delayMs > 0) {
      await waitForDelay(delayMs);
    }

    try {
      if ((await readActive()) === expectedActive) {
        return true;
      }
    } catch {
      // A transient API failure is retried within the bounded polling window.
    }
  }

  return false;
}
