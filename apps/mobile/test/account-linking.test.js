const assert = require('node:assert/strict');
const test = require('node:test');

const {
  AccountLinkingError,
  checkEmailAccountLink,
  getAccountIdentity,
  normalizeAccountEmail,
  requestEmailAccountLink,
} = require('../services/account-linking.ts');

function user(overrides = {}) {
  return {
    app_metadata: {},
    aud: 'authenticated',
    created_at: '2026-08-24T10:00:00.000Z',
    id: '00000000-0000-4000-8000-000000000001',
    is_anonymous: true,
    user_metadata: {},
    ...overrides,
  };
}

test('normalizes email input', () => {
  assert.equal(normalizeAccountEmail('  TEST@Example.COM '), 'test@example.com');
  assert.equal(normalizeAccountEmail('INFO@EXAMPLE.COM'), 'info@example.com');
  assert.equal(normalizeAccountEmail('invalid-address'), null);
});

test('summarizes anonymous and pending email identity', () => {
  assert.deepEqual(
    getAccountIdentity(user({ email: 'anon@example.com', new_email: 'kalici@example.com' })),
    {
      email: 'anon@example.com',
      isAnonymous: true,
      pendingEmail: 'kalici@example.com',
      userId: '00000000-0000-4000-8000-000000000001',
    },
  );
});

test('requests an email link without changing the anonymous user id', async () => {
  const anonymousUser = user();
  let requestedEmail = null;
  const auth = {
    async getSession() {
      return { data: { session: { user: anonymousUser } }, error: null };
    },
    async updateUser(attributes) {
      requestedEmail = attributes.email;
      return {
        data: { user: user({ new_email: attributes.email }) },
        error: null,
      };
    },
  };

  const result = await requestEmailAccountLink('Test@Example.com', auth);
  assert.equal(requestedEmail, 'test@example.com');
  assert.deepEqual(result, {
    email: 'test@example.com',
    userId: anonymousUser.id,
  });
});

test('checks confirmed email link and preserves the original user id', async () => {
  const anonymousUser = user();
  const permanentUser = user({ email: 'test@example.com', is_anonymous: false });
  let refreshed = false;
  const auth = {
    async getSession() {
      return { data: { session: { user: anonymousUser } }, error: null };
    },
    async getUser() {
      return { data: { user: permanentUser }, error: null };
    },
    async refreshSession() {
      refreshed = true;
      return { data: { session: null, user: permanentUser }, error: null };
    },
  };

  const result = await checkEmailAccountLink(auth);
  assert.equal(refreshed, true);
  assert.equal(result.userId, anonymousUser.id);
  assert.equal(result.isAnonymous, false);
});

test('rejects a verification response that switches user identity', async () => {
  const auth = {
    async getSession() {
      return { data: { session: { user: user() } }, error: null };
    },
    async getUser() {
      return {
        data: {
          user: user({
            id: '00000000-0000-4000-8000-000000000002',
            is_anonymous: false,
          }),
        },
        error: null,
      };
    },
    async refreshSession() {
      return { data: { session: null, user: null }, error: null };
    },
  };

  await assert.rejects(
    () => checkEmailAccountLink(auth),
    (error) => error instanceof AccountLinkingError && error.code === 'IDENTITY_CHANGED',
  );
});
