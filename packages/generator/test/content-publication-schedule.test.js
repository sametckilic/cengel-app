const assert = require('node:assert/strict');
const test = require('node:test');
const { isDeepStrictEqual } = require('node:util');

const {
  CONTENT_PUBLICATION_PLAN,
  CONTENT_RELEASE_DATE,
  createScheduledContentPublication,
} = require('../src/content-publication-schedule');
const {
  NEWSPAPER_V2_RECIPE_MATRIX,
} = require('../src/newspaper-recipe-matrix');

test('defines a versioned archive and culture pack release', () => {
  const archiveItems = CONTENT_PUBLICATION_PLAN.filter(
    ({ channel }) => channel === 'archive',
  );
  const packItems = CONTENT_PUBLICATION_PLAN.filter(
    ({ channel }) => channel === 'pack',
  );

  assert.equal(CONTENT_RELEASE_DATE, '2026-08-29');
  assert.equal(archiveItems.length, 2);
  assert.deepEqual(
    archiveItems.map(({ puzzleId }) => puzzleId),
    ['arsiv-baslangic-001', 'arsiv-kolay-001'],
  );
  assert.deepEqual(
    packItems.map(({ packId, puzzleNumber, puzzleId }) => ({
      packId,
      puzzleId,
      puzzleNumber,
    })),
    [
      {
        packId: 'kultur-sanat',
        puzzleId: 'kultur-sanat-001',
        puzzleNumber: 1,
      },
      {
        packId: 'kultur-sanat',
        puzzleId: 'kultur-sanat-002',
        puzzleNumber: 2,
      },
    ],
  );
  assert.ok(
    CONTENT_PUBLICATION_PLAN.every(
      ({ profile }) =>
        profile.generatorVersion === 'newspaper-v2' &&
        profile.categoryWeight > 0.5 &&
        profile.rowCount > 0 &&
        profile.columnCount > 0 &&
        profile.targetWordCount > 0,
    ),
  );
  assert.ok(
    CONTENT_PUBLICATION_PLAN.every(
      ({ seed }) => typeof seed === 'string' && seed.length > 0,
    ),
  );

  for (const item of archiveItems) {
    assert.ok(
      NEWSPAPER_V2_RECIPE_MATRIX.some(
        ({ profileId: _profileId, title: _title, ...profile }) =>
          isDeepStrictEqual(profile, item.profile),
      ),
      `Archive profile ${item.profileId} must come from the V2 matrix.`,
    );
  }
});

test('retries a content seed without changing its explicit generation request', () => {
  const requests = [];
  const item = CONTENT_PUBLICATION_PLAN[0];
  const publication = createScheduledContentPublication(
    { entries: [] },
    item,
    {
      publicationFactory: (_catalog, request) => {
        requests.push(request);

        if (requests.length === 1) {
          throw new Error('Synthetic fill failure.');
        }

        return request;
      },
    },
  );

  assert.equal(requests.length, 2);
  assert.equal(publication.revision, 'content-v1-a2');
  assert.deepEqual(requests[0].profile, item.profile);
  assert.equal(requests[0].puzzleId, item.puzzleId);
  assert.equal(requests[0].date, item.publicationDate);
  assert.equal(requests[0].revision, 'content-v1-a1');
  assert.equal(requests[0].seed, item.seed);
  assert.equal(requests[1].revision, 'content-v1-a2');
  assert.equal(requests[1].seed, `${item.seed}:retry-2`);
});

test('rejects a content plan item without an explicit deterministic seed', () => {
  assert.throws(
    () =>
      createScheduledContentPublication(
        { entries: [] },
        { ...CONTENT_PUBLICATION_PLAN[0], seed: '' },
        { publicationFactory: () => ({}) },
      ),
    /seed is required/,
  );
});
