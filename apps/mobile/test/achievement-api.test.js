const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isAchievementApiResponse,
} = require('../../../packages/contracts/src/achievement-api.ts');

const response = {
  apiVersion: 1,
  items: [
    {
      description: 'İlk bulmacanı tamamla.',
      earnedAt: '2026-08-24T12:00:00.000Z',
      id: 'first-completion',
      target: 1,
      title: 'İlk Çözüm',
      type: 'completion',
      verification: 'casual',
    },
  ],
};

test('accepts a valid achievement API response', () => {
  assert.equal(isAchievementApiResponse(response), true);
});

test('rejects duplicate, unknown, and malformed achievement items', () => {
  assert.equal(isAchievementApiResponse({ ...response, items: [...response.items, response.items[0]] }), false);
  assert.equal(
    isAchievementApiResponse({
      ...response,
      items: [{ ...response.items[0], id: 'unknown-achievement' }],
    }),
    false,
  );
  assert.equal(
    isAchievementApiResponse({
      ...response,
      items: [{ ...response.items[0], earnedAt: 'not-a-date' }],
    }),
    false,
  );
});
