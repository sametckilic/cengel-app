const assert = require('node:assert/strict');
const test = require('node:test');

const {
  PasswordAuthError,
  getAccountIdentity,
  loginWithPassword,
  normalizeAccountEmail,
  registerWithPassword,
  validateAccountPassword,
} = require('../services/password-auth.ts');

function user(overrides = {}) {
  return {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-24T10:00:00.000Z',
    email: 'test@example.com',
    id: '00000000-0000-4000-8000-000000000001',
    is_anonymous: false,
    user_metadata: {},
    ...overrides,
  };
}

test('normalizes email and validates the local password floor', () => {
  assert.equal(normalizeAccountEmail(' INFO@EXAMPLE.COM '), 'info@example.com');
  assert.equal(normalizeAccountEmail('invalid-address'), null);
  assert.equal(validateAccountPassword('12345678'), '12345678');
  assert.equal(validateAccountPassword('1234567'), null);
});

test('rejects anonymous users as account identities', () => {
  assert.throws(
    () => getAccountIdentity(user({ is_anonymous: true })),
    (error) => error instanceof PasswordAuthError && error.code === 'IDENTITY_INVALID',
  );
});

test('registers with normalized email and a matching password', async () => {
  let received = null;
  const auth = {
    async signUp(input) {
      received = input;
      return {
        data: { session: { access_token: 'token' }, user: user() },
        error: null,
      };
    },
  };

  const account = await registerWithPassword(
    'TEST@example.com',
    'password-1',
    'password-1',
    auth,
  );
  assert.deepEqual(received, { email: 'test@example.com', password: 'password-1' });
  assert.equal(account.userId, user().id);
});

test('requires Confirm Email to be disabled for direct registration', async () => {
  const auth = {
    async signUp() {
      return { data: { session: null, user: user() }, error: null };
    },
  };

  await assert.rejects(
    () => registerWithPassword('test@example.com', 'password-1', 'password-1', auth),
    (error) =>
      error instanceof PasswordAuthError && error.code === 'EMAIL_CONFIRMATION_REQUIRED',
  );
});

test('rejects mismatched password confirmation before network access', async () => {
  await assert.rejects(
    () => registerWithPassword('test@example.com', 'password-1', 'password-2'),
    (error) => error instanceof PasswordAuthError && error.code === 'PASSWORD_MISMATCH',
  );
});

test('signs in with email and password', async () => {
  const auth = {
    async signInWithPassword(input) {
      assert.deepEqual(input, { email: 'test@example.com', password: 'password-1' });
      return { data: { session: { access_token: 'token' }, user: user() }, error: null };
    },
  };

  const account = await loginWithPassword('test@example.com', 'password-1', auth);
  assert.equal(account.email, 'test@example.com');
});
