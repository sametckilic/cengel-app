import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
} from 'react-native-purchases';

export const PREMIUM_ENTITLEMENT_ID = 'premium_access';

export type PremiumEntitlement = {
  active: boolean;
  expiresAt: string | null;
  productId: string | null;
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

export async function disconnectRevenueCat(): Promise<void> {
  if (!(await Purchases.isConfigured())) {
    return;
  }

  const userId = await Purchases.getAppUserID();

  if (!userId.startsWith('$RCAnonymousID:')) {
    await Purchases.logOut();
  }
}
