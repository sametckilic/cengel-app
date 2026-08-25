import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';

import { useAuth } from '@/providers/auth-provider';
import { getConfiguredRevenueCatApiKey } from '@/services/revenuecat-config';
import {
  connectRevenueCat,
  disconnectRevenueCat,
  getPremiumEntitlement,
  type PremiumEntitlement,
} from '@/services/revenuecat-client';

type RevenueCatStatus =
  | 'error'
  | 'guest'
  | 'loading'
  | 'ready'
  | 'unconfigured'
  | 'unsupported';

type RevenueCatContextValue = {
  error: string | null;
  premium: PremiumEntitlement;
  refresh(): Promise<void>;
  status: RevenueCatStatus;
};

const EMPTY_PREMIUM: PremiumEntitlement = {
  active: false,
  expiresAt: null,
  productId: null,
};

const RevenueCatContext = createContext<RevenueCatContextValue | null>(null);

export function RevenueCatProvider({ children }: PropsWithChildren) {
  const { account, status: authStatus } = useAuth();
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const apiKey = getConfiguredRevenueCatApiKey(platform);
  const [premium, setPremium] = useState(EMPTY_PREMIUM);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!apiKey || !account) {
      setPremium(EMPTY_PREMIUM);
      return;
    }

    setLoading(true);

    try {
      const customerInfo = await connectRevenueCat(apiKey, account.userId);
      setPremium(getPremiumEntitlement(customerInfo));
      setError(null);
    } catch (reason) {
      setPremium(EMPTY_PREMIUM);
      setError(
        reason instanceof Error
          ? reason.message
          : 'RevenueCat abonelik bilgisi yÃ¼klenemedi.',
      );
    } finally {
      setLoading(false);
    }
  }, [account, apiKey]);

  useEffect(() => {
    if (authStatus === 'loading') {
      return;
    }

    if (!account) {
      setPremium(EMPTY_PREMIUM);
      setError(null);
      void disconnectRevenueCat().catch(() => undefined);
      return;
    }

    void refresh();
  }, [account, authStatus, refresh]);

  const status: RevenueCatStatus =
    platform === 'web'
      ? 'unsupported'
      : !apiKey
        ? 'unconfigured'
        : authStatus === 'loading' || loading
          ? 'loading'
          : !account
            ? 'guest'
            : error
              ? 'error'
              : 'ready';
  const value = useMemo<RevenueCatContextValue>(
    () => ({ error, premium, refresh, status }),
    [error, premium, refresh, status],
  );

  return <RevenueCatContext.Provider value={value}>{children}</RevenueCatContext.Provider>;
}

export function useRevenueCat(): RevenueCatContextValue {
  const value = useContext(RevenueCatContext);

  if (!value) {
    throw new Error('useRevenueCat must be used inside RevenueCatProvider.');
  }

  return value;
}
