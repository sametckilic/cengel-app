import {
  isAccountEntitlementsResponse,
  pollEntitlementState,
} from '@/services/entitlement-state';
import { getPuzzleApiOrigin } from '@/services/puzzle-catalog-client';
import { getAuthenticatedAccess } from '@/services/supabase-client';

export function getEntitlementsApiUrl(): string | null {
  const origin = getPuzzleApiOrigin();

  return origin
    ? new URL('v1/me/entitlements', `${origin.replace(/\/$/, '')}/`).toString()
    : null;
}

async function readEntitlementActive(
  url: string,
  accessToken: string,
  entitlementId: string,
): Promise<boolean | null> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Entitlement request failed with status ${response.status}.`);
  }

  const value: unknown = await response.json();

  if (!isAccountEntitlementsResponse(value)) {
    throw new Error('Entitlement API returned an invalid response.');
  }

  return (
    value.items.find((item) => item.entitlementId === entitlementId)?.active ??
    null
  );
}

export async function waitForBackendEntitlement(
  entitlementId: string,
  expectedActive: boolean,
): Promise<boolean> {
  const [url, access] = await Promise.all([
    Promise.resolve(getEntitlementsApiUrl()),
    getAuthenticatedAccess(),
  ]);

  if (!url || !access) {
    return false;
  }

  return pollEntitlementState({
    expectedActive,
    readActive: () => readEntitlementActive(url, access.accessToken, entitlementId),
  });
}
