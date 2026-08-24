import type { SupabaseClient, User } from '@supabase/supabase-js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MINIMUM_PASSWORD_LENGTH = 8;

export type PasswordAuthClient = Pick<
  SupabaseClient['auth'],
  'getSession' | 'getUser' | 'signInWithPassword' | 'signOut' | 'signUp'
>;

export type AccountIdentity = {
  email: string;
  userId: string;
};

type PasswordAuthErrorCode =
  | 'AUTH_UNAVAILABLE'
  | 'EMAIL_CONFIRMATION_REQUIRED'
  | 'IDENTITY_INVALID'
  | 'INVALID_EMAIL'
  | 'INVALID_PASSWORD'
  | 'PASSWORD_MISMATCH'
  | 'PROVIDER_ERROR';

export class PasswordAuthError extends Error {
  readonly code: PasswordAuthErrorCode;

  constructor(code: PasswordAuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'PasswordAuthError';
  }
}

export function normalizeAccountEmail(value: string): string | null {
  const normalized = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(normalized) ? normalized : null;
}

export function validateAccountPassword(value: string): string | null {
  return value.length >= MINIMUM_PASSWORD_LENGTH ? value : null;
}

export function getAccountIdentity(user: User): AccountIdentity {
  if (!user.email || user.is_anonymous) {
    throw new PasswordAuthError('IDENTITY_INVALID', 'Geçerli bir kullanıcı hesabı bulunamadı.');
  }

  return { email: user.email, userId: user.id };
}

function requireAuth(auth: PasswordAuthClient | undefined): PasswordAuthClient {
  if (!auth) {
    throw new PasswordAuthError('AUTH_UNAVAILABLE', 'Hesap işlemleri şu anda kullanılamıyor.');
  }

  return auth;
}

function providerError(error: { code?: string; message: string }): PasswordAuthError {
  const message = (() => {
    switch (error.code) {
      case 'email_exists':
      case 'user_already_exists':
        return 'Bu e-posta adresiyle daha önce hesap oluşturulmuş.';
      case 'email_not_confirmed':
        return 'E-posta onayı açık. Doğrudan kayıt için Supabase Confirm Email ayarını kapatın.';
      case 'email_provider_disabled':
        return 'E-posta ve şifreyle giriş Supabase projesinde kapalı.';
      case 'invalid_credentials':
        return 'E-posta adresi veya şifre hatalı.';
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return 'Çok sık deneme yapıldı. Lütfen biraz bekleyip tekrar deneyin.';
      case 'weak_password':
        return 'Şifre Supabase güvenlik koşullarını karşılamıyor.';
      default:
        return error.message;
    }
  })();

  return new PasswordAuthError('PROVIDER_ERROR', message);
}

function credentials(
  emailValue: string,
  passwordValue: string,
): { email: string; password: string } {
  const email = normalizeAccountEmail(emailValue);
  const password = validateAccountPassword(passwordValue);

  if (!email) {
    throw new PasswordAuthError('INVALID_EMAIL', 'Geçerli bir e-posta adresi girin.');
  }

  if (!password) {
    throw new PasswordAuthError(
      'INVALID_PASSWORD',
      `Şifre en az ${MINIMUM_PASSWORD_LENGTH} karakter olmalı.`,
    );
  }

  return { email, password };
}

export async function registerWithPassword(
  emailValue: string,
  passwordValue: string,
  confirmationValue: string,
  authOverride?: PasswordAuthClient,
): Promise<AccountIdentity> {
  const input = credentials(emailValue, passwordValue);

  if (passwordValue !== confirmationValue) {
    throw new PasswordAuthError('PASSWORD_MISMATCH', 'Şifreler birbiriyle eşleşmiyor.');
  }

  const auth = requireAuth(authOverride);
  const response = await auth.signUp(input);

  if (response.error) {
    throw providerError(response.error);
  }

  if (!response.data.session || !response.data.user) {
    throw new PasswordAuthError(
      'EMAIL_CONFIRMATION_REQUIRED',
      'Supabase Confirm Email ayarı açık olduğu için doğrudan kayıt tamamlanamadı.',
    );
  }

  return getAccountIdentity(response.data.user);
}

export async function loginWithPassword(
  emailValue: string,
  passwordValue: string,
  authOverride?: PasswordAuthClient,
): Promise<AccountIdentity> {
  const input = credentials(emailValue, passwordValue);
  const auth = requireAuth(authOverride);
  const response = await auth.signInWithPassword(input);

  if (response.error) {
    throw providerError(response.error);
  }

  return getAccountIdentity(response.data.user);
}

export async function logoutCurrentAccount(
  authOverride?: PasswordAuthClient,
): Promise<void> {
  const auth = requireAuth(authOverride);
  const response = await auth.signOut({ scope: 'local' });

  if (response.error) {
    throw providerError(response.error);
  }
}
