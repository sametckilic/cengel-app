import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesPackage,
} from 'react-native-purchases';

import {
  isPurchaseCancelled,
} from '@/services/revenuecat-state';

export { describePremiumPackage, type PremiumPackage } from '@/services/revenuecat-state';

export const PREMIUM_ENTITLEMENT_ID = 'premium_access';

export type PremiumEntitlement = {
  active: boolean;
  expiresAt: string | null;
  productId: string | null;
};

export type PremiumPurchaseResult = {
  customerInfo: CustomerInfo | null;
  status: 'cancelled' | 'success';
};

export function getPremiumEntitlement(
  customerInfo: Pick<CustomerInfo, 'entitlements'>,
): PremiumEntitlement {
  const entitlement = customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID];

  return {
    active: entitlement?.isActive ?? false,
    expiresAt: entitlement?.expirationDate ?? null,
    productId: entitlement?.productIdentifier ?? null,
  };
}

export async function connectRevenueCat(
  apiKey: string,
  userId: string,
): Promise<CustomerInfo> {
  const configured = await Purchases.isConfigured();

  if (!configured) {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    Purchases.configure({ apiKey, appUserID: userId });
  } else if ((await Purchases.getAppUserID()) !== userId) {
    await Purchases.logIn(userId);
  }

  return Purchases.getCustomerInfo();
}

export async function getCurrentPremiumPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;

  return current?.monthly ?? current?.availablePackages[0] ?? null;
}

export async function purchasePremiumPackage(
  purchasePackage: PurchasesPackage,
): Promise<PremiumPurchaseResult> {
  try {
    const result = await Purchases.purchasePackage(purchasePackage);
    return { customerInfo: result.customerInfo, status: 'success' };
  } catch (reason) {
    if (isPurchaseCancelled(reason)) {
      return { customerInfo: null, status: 'cancelled' };
    }

    throw reason;
  }
}

export async function restorePremiumPurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

export async function disconnectRevenueCat(): Promise<void> {
  if (!(await Purchases.isConfigured())) {
    return;
  }

  const userId = await Purchases.getAppUserID();

  if (!userId.startsWith('$RCAnonymousID:')) {
    await Purchases.logOut();
  }
}
