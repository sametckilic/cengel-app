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
  getAccountIdentity,
  loginWithPassword,
  logoutCurrentAccount,
  registerWithPassword,
  type AccountIdentity,
} from '@/services/password-auth';
import { getSupabaseClient } from '@/services/supabase-client';

type AuthStatus = 'authenticated' | 'guest' | 'loading' | 'unconfigured';

type AuthContextValue = {
  account: AccountIdentity | null;
  error: string | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  register(email: string, password: string, confirmation: string): Promise<void>;
  status: AuthStatus;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = getSupabaseClient() !== null;

  const loadUser = useCallback(async () => {
    const supabase = getSupabaseClient();

    if (!supabase) {
      setLoading(false);
      return;
    }

    try {
      const current = await supabase.auth.getSession();

      if (current.error) {
        throw current.error;
      }

      if (current.data.session?.user.is_anonymous) {
        const legacyLogout = await supabase.auth.signOut({ scope: 'local' });

        if (legacyLogout.error) {
          throw legacyLogout.error;
        }

        setUser(null);
        setError(null);
        return;
      }

      if (!current.data.session) {
        setUser(null);
        setError(null);
        return;
      }

      const verified = await supabase.auth.getUser();

      if (verified.error) {
        throw verified.error;
      }

      setUser(verified.data.user);
      setError(null);
    } catch (reason) {
      setUser(null);
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
      setUser(session?.user.is_anonymous ? null : (session?.user ?? null));
    });

    void loadUser();
    return () => subscription.data.subscription.unsubscribe();
  }, [loadUser]);

  const login = useCallback(async (email: string, password: string) => {
    setError(null);

    try {
      const account = await loginWithPassword(email, password, getSupabaseClient()?.auth);
      const current = await getSupabaseClient()?.auth.getUser();
      setUser(current?.data.user ?? null);

      if (!current?.data.user || current.data.user.id !== account.userId) {
        throw new Error('Giriş oturumu doğrulanamadı.');
      }
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Giriş yapılamadı.';
      setError(message);
      throw reason;
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, confirmation: string) => {
      setError(null);

      try {
        const account = await registerWithPassword(
          email,
          password,
          confirmation,
          getSupabaseClient()?.auth,
        );
        const current = await getSupabaseClient()?.auth.getUser();
        setUser(current?.data.user ?? null);

        if (!current?.data.user || current.data.user.id !== account.userId) {
          throw new Error('Kayıt oturumu doğrulanamadı.');
        }
      } catch (reason) {
        const message = reason instanceof Error ? reason.message : 'Hesap oluşturulamadı.';
        setError(message);
        throw reason;
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    setError(null);

    try {
      await logoutCurrentAccount(getSupabaseClient()?.auth);
      setUser(null);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Çıkış yapılamadı.';
      setError(message);
      throw reason;
    }
  }, []);

  const account = useMemo(() => (user ? getAccountIdentity(user) : null), [user]);
  const status: AuthStatus = !configured
    ? 'unconfigured'
    : loading
      ? 'loading'
      : account
        ? 'authenticated'
        : 'guest';
  const value = useMemo<AuthContextValue>(
    () => ({ account, error, login, logout, register, status }),
    [account, error, login, logout, register, status],
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
