import type { SupabaseClient, User } from '@supabase/supabase-js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type AccountLinkingAuth = Pick<
  SupabaseClient['auth'],
  'getSession' | 'getUser' | 'refreshSession' | 'resend' | 'updateUser'
>;

export type AccountIdentity = {
  email: string | null;
  isAnonymous: boolean;
  pendingEmail: string | null;
  userId: string;
};

type AccountLinkingErrorCode =
  | 'ALREADY_LINKED'
  | 'AUTH_UNAVAILABLE'
  | 'IDENTITY_CHANGED'
  | 'INVALID_EMAIL'
  | 'LINK_NOT_CONFIRMED'
  | 'NO_SESSION'
  | 'PROVIDER_ERROR';

export class AccountLinkingError extends Error {
  readonly code: AccountLinkingErrorCode;

  constructor(code: AccountLinkingErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'AccountLinkingError';
  }
}

export function normalizeAccountEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function getAccountIdentity(user: User): AccountIdentity {
  return {
    email: user.email ?? null,
    isAnonymous: user.is_anonymous === true,
    pendingEmail: user.new_email ?? null,
    userId: user.id,
  };
}

function requireAuth(auth: AccountLinkingAuth | undefined): AccountLinkingAuth {
  if (!auth) {
    throw new AccountLinkingError(
      'AUTH_UNAVAILABLE',
      'Hesap bağlantısı şu anda kullanılamıyor.',
    );
  }

  return auth;
}

async function requireCurrentUser(auth: AccountLinkingAuth): Promise<User> {
  const current = await auth.getSession();

  if (current.error) {
    throw new AccountLinkingError('PROVIDER_ERROR', current.error.message);
  }

  if (!current.data.session?.user) {
    throw new AccountLinkingError('NO_SESSION', 'Aktif kullanıcı oturumu bulunamadı.');
  }

  return current.data.session.user;
}

function providerError(error: { code?: string; message: string }): AccountLinkingError {
  const message = (() => {
    switch (error.code) {
      case 'email_exists':
      case 'user_already_exists':
        return 'Bu e-posta adresi başka bir hesaba bağlı.';
      case 'email_address_not_authorized':
        return 'Bu e-posta adresine doğrulama gönderilemiyor.';
      case 'otp_expired':
        return 'Doğrulama bağlantısının süresi dolmuş. Yeni bir e-posta isteyin.';
      case 'otp_disabled':
        return 'E-posta doğrulaması şu anda kullanılamıyor.';
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return 'Çok sık deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.';
      default:
        return error.message;
    }
  })();

  return new AccountLinkingError('PROVIDER_ERROR', message);
}

export async function requestEmailAccountLink(
  value: string,
  authOverride?: AccountLinkingAuth,
): Promise<{ email: string; userId: string }> {
  const email = normalizeAccountEmail(value);

  if (!email) {
    throw new AccountLinkingError('INVALID_EMAIL', 'Geçerli bir e-posta adresi girin.');
  }

  const auth = requireAuth(authOverride);
  const currentUser = await requireCurrentUser(auth);

  if (!currentUser.is_anonymous) {
    throw new AccountLinkingError('ALREADY_LINKED', 'Bu hesap zaten güvenceye alınmış.');
  }

  const update = await auth.updateUser({ email });

  if (update.error) {
    throw providerError(update.error);
  }

  if (update.data.user.id !== currentUser.id) {
    throw new AccountLinkingError(
      'IDENTITY_CHANGED',
      'Hesap kimliği beklenmedik biçimde değişti.',
    );
  }

  return { email, userId: currentUser.id };
}

export async function checkEmailAccountLink(
  authOverride?: AccountLinkingAuth,
): Promise<AccountIdentity> {
  const auth = requireAuth(authOverride);
  const currentUser = await requireCurrentUser(auth);
  const refresh = await auth.refreshSession();

  if (refresh.error) {
    throw providerError(refresh.error);
  }

  const refreshed = await auth.getUser();

  if (refreshed.error) {
    throw providerError(refreshed.error);
  }

  const linkedUser = refreshed.data.user;

  if (linkedUser.id !== currentUser.id) {
    throw new AccountLinkingError(
      'IDENTITY_CHANGED',
      'Doğrulama farklı bir kullanıcı oturumu döndürdü.',
    );
  }

  if (linkedUser.is_anonymous) {
    throw new AccountLinkingError(
      'LINK_NOT_CONFIRMED',
      'E-posta bağlantısı henüz onaylanmadı. Mesajdaki doğrulama bağlantısına dokunun.',
    );
  }

  return getAccountIdentity(linkedUser);
}

export async function resendEmailAccountLink(
  value: string,
  authOverride?: AccountLinkingAuth,
): Promise<string> {
  const email = normalizeAccountEmail(value);

  if (!email) {
    throw new AccountLinkingError('INVALID_EMAIL', 'Geçerli bir e-posta adresi girin.');
  }

  const auth = requireAuth(authOverride);
  await requireCurrentUser(auth);
  const resend = await auth.resend({ email, type: 'email_change' });

  if (resend.error) {
    throw providerError(resend.error);
  }

  return email;
}
