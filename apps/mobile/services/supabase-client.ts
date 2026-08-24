import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { authStorage } from '@/services/auth-storage';

let client: SupabaseClient | null | undefined;

function readSupabaseConfiguration(): {
  publishableKey: string;
  url: string;
} | null {
  const publishableKey =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();

  return publishableKey && url ? { publishableKey, url } : null;
}

export function getSupabaseClient(): SupabaseClient | null {
  if (client !== undefined) {
    return client;
  }

  const configuration = readSupabaseConfiguration();

  if (!configuration) {
    client = null;
    return client;
  }

  client = createClient(configuration.url, configuration.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === 'web',
      persistSession: true,
      storage: authStorage,
    },
  });
  return client;
}

export async function getAuthenticatedAccess(): Promise<{
  accessToken: string;
  userId: string;
} | null> {
  const supabase = getSupabaseClient();

  if (!supabase) {
    return null;
  }

  const current = await supabase.auth.getSession();

  if (current.error) {
    throw current.error;
  }

  const session = current.data.session;

  return session && !session.user.is_anonymous
    ? { accessToken: session.access_token, userId: session.user.id }
    : null;
}
