import type { User } from '@supabase/supabase-js';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  checkEmailAccountLink,
  getAccountIdentity,
  requestEmailAccountLink,
  resendEmailAccountLink,
  type AccountIdentity,
} from '@/services/account-linking';
import { ensureAnonymousAccessToken, getSupabaseClient } from '@/services/supabase-client';

type AuthStatus = 'anonymous' | 'error' | 'loading' | 'permanent' | 'unconfigured';

type AuthContextValue = {
  account: AccountIdentity | null;
  error: string | null;
  pendingEmail: string | null;
  checkEmailLink(): Promise<void>;
  requestEmailLink(email: string): Promise<void>;
  resendEmailLink(): Promise<void>;
  status: AuthStatus;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = getSupabaseClient() !== null;

  const refreshUser = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      await ensureAnonymousAccessToken();
      const current = await supabase.auth.getUser();

      if (current.error) {
        throw current.error;
      }

      setUser(current.data.user);
      setPendingEmail(current.data.user.new_email ?? null);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kullanıcı oturumu yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setLoading(false);
      return;
    }

    const subscription = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);

      if (session?.user.new_email) {
        setPendingEmail(session.user.new_email);
      }
    });

    void refreshUser();
    return () => subscription.data.subscription.unsubscribe();
  }, [refreshUser]);

  const requestEmailLink = useCallback(async (email: string) => {
    setError(null);

    try {
      const request = await requestEmailAccountLink(email, getSupabaseClient()?.auth);
      setPendingEmail(request.email);
      const current = await getSupabaseClient()?.auth.getUser();

      if (current?.data.user) {
        setUser(current.data.user);
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Doğrulama e-postası gönderilemedi.';
      setError(message);
      throw reason;
    }
  }, []);

  const checkEmailLink = useCallback(
    async () => {
      if (!pendingEmail) {
        const reason = new Error('Önce doğrulama e-postası isteyin.');
        setError(reason.message);
        throw reason;
      }

      setError(null);

      try {
        const account = await checkEmailAccountLink(getSupabaseClient()?.auth);
        const current = await getSupabaseClient()?.auth.getUser();
        setUser(current?.data.user ?? null);
        setPendingEmail(account.pendingEmail);
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'E-posta bağlantısı doğrulanamadı.';
        setError(message);
        throw reason;
      }
    },
    [pendingEmail],
  );

  const resendEmailLink = useCallback(async () => {
    if (!pendingEmail) {
      const reason = new Error('Tekrar gönderilecek e-posta adresi bulunamadı.');
      setError(reason.message);
      throw reason;
    }

    setError(null);

    try {
      await resendEmailAccountLink(pendingEmail, getSupabaseClient()?.auth);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'E-posta tekrar gönderilemedi.';
      setError(message);
      throw reason;
    }
  }, [pendingEmail]);

  const account = user ? getAccountIdentity(user) : null;
  const status: AuthStatus = !configured
    ? 'unconfigured'
    : loading
      ? 'loading'
      : account?.isAnonymous
        ? 'anonymous'
        : account
          ? 'permanent'
          : 'error';
  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      checkEmailLink,
      error,
      pendingEmail,
      requestEmailLink,
      resendEmailLink,
      status,
    }),
    [account, checkEmailLink, error, pendingEmail, requestEmailLink, resendEmailLink, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return value;
}
