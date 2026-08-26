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
import { usePuzzleCatalog } from '@/providers/puzzle-catalog-provider';
import { waitForBackendEntitlement } from '@/services/entitlement-client';
import { getConfiguredRevenueCatApiKey } from '@/services/revenuecat-config';
import {
  connectRevenueCat,
  describePremiumPackage,
  disconnectRevenueCat,
  getCurrentPremiumPackage,
  getPremiumEntitlement,
  PREMIUM_ENTITLEMENT_ID,
  purchasePremiumPackage,
  restorePremiumPurchases,
  type PremiumEntitlement,
  type PremiumPackage,
} from '@/services/revenuecat-client';

type RevenueCatStatus =
  | 'error'
  | 'guest'
  | 'loading'
  | 'ready'
  | 'unconfigured'
  | 'unsupported';

type RevenueCatContextValue = {
  backendSync: 'delayed' | 'idle' | 'synced' | 'syncing';
  busy: boolean;
  error: string | null;
  package: PremiumPackage | null;
  premium: PremiumEntitlement;
  purchase(): Promise<'cancelled' | 'success'>;
  refresh(): Promise<void>;
  retryBackendSync(): Promise<void>;
  restore(): Promise<void>;
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
  const { refreshCatalog } = usePuzzleCatalog();
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const apiKey = getConfiguredRevenueCatApiKey(platform);
  const [premium, setPremium] = useState(EMPTY_PREMIUM);
  const [purchasePackage, setPurchasePackage] = useState<Awaited<
    ReturnType<typeof getCurrentPremiumPackage>
  >>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [backendSync, setBackendSync] = useState<
    RevenueCatContextValue['backendSync']
  >('idle');

  const synchronizeBackend = useCallback(
    async (expectedActive: boolean) => {
      if (!account) {
        setBackendSync('idle');
        return;
      }

      setBackendSync('syncing');
      const synchronized = await waitForBackendEntitlement(
        PREMIUM_ENTITLEMENT_ID,
        expectedActive,
      );
      setBackendSync(synchronized ? 'synced' : 'delayed');
      refreshCatalog();
    },
    [account, refreshCatalog],
  );

  const refresh = useCallback(async () => {
    if (!apiKey || !account) {
      setPremium(EMPTY_PREMIUM);
      return;
    }

    setLoading(true);

    try {
      const customerInfo = await connectRevenueCat(apiKey, account.userId);
      const currentPackage = await getCurrentPremiumPackage();
      setPremium(getPremiumEntitlement(customerInfo));
      setPurchasePackage(currentPackage);
      setError(null);
    } catch (reason) {
      setPremium(EMPTY_PREMIUM);
      setPurchasePackage(null);
      setError(
        reason instanceof Error
          ? reason.message
          : 'RevenueCat abonelik bilgisi yüklenemedi.',
      );
    } finally {
      setLoading(false);
    }
  }, [account, apiKey]);

  const purchase = useCallback(async (): Promise<'cancelled' | 'success'> => {
    if (!purchasePackage || !account) {
      throw new Error('Satın alınabilir Premium paketi bulunamadı.');
    }

    setBusy(true);
    setError(null);

    try {
      const result = await purchasePremiumPackage(purchasePackage);

      if (result.customerInfo) {
        const entitlement = getPremiumEntitlement(result.customerInfo);
        setPremium(entitlement);

        if (result.status === 'success') {
          await synchronizeBackend(entitlement.active);
        }
      }

      return result.status;
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : 'Premium satın alma tamamlanamadı.';
      setError(message);
      throw reason;
    } finally {
      setBusy(false);
    }
  }, [account, purchasePackage, synchronizeBackend]);

  const restore = useCallback(async (): Promise<void> => {
    if (!account) {
      throw new Error('Satın alımları geri yüklemek için giriş yapmalısın.');
    }

    setBusy(true);
    setError(null);

    try {
      const customerInfo = await restorePremiumPurchases();
      const entitlement = getPremiumEntitlement(customerInfo);
      setPremium(entitlement);
      await synchronizeBackend(entitlement.active);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : 'Satın alımlar geri yüklenemedi.';
      setError(message);
      throw reason;
    } finally {
      setBusy(false);
    }
  }, [account, synchronizeBackend]);

  const retryBackendSync = useCallback(async () => {
    await synchronizeBackend(premium.active);
  }, [premium.active, synchronizeBackend]);

  useEffect(() => {
    if (authStatus === 'loading') {
      return;
    }

    if (!account) {
      setPremium(EMPTY_PREMIUM);
      setPurchasePackage(null);
      setError(null);
      setBackendSync('idle');
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
    () => ({
      backendSync,
      busy,
      error,
      package: describePremiumPackage(purchasePackage),
      premium,
      purchase,
      refresh,
      restore,
      retryBackendSync,
      status,
    }),
    [
      backendSync,
      busy,
      error,
      premium,
      purchase,
      purchasePackage,
      refresh,
      restore,
      retryBackendSync,
      status,
    ],
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
