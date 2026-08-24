const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../../../apps/mobile/data/generated/clue-catalog.json');
const {
  addDaysToIsoDate,
  createDailyPublicationSchedule,
  createScheduledDailyPublication,
  getRotatedProfileIds,
} = require('../src/daily-puzzle-schedule');

test('rotates daily size, difficulty, and category profiles deterministically', () => {
  assert.deepEqual(getRotatedProfileIds('2026-08-24'), [
    'beginner-geography-compact',
    'easy-mixed-wide',
    'medium-literature-balanced',
  ]);
  assert.equal(getRotatedProfileIds('2026-08-25')[0], 'easy-mixed-wide');
  assert.equal(getRotatedProfileIds('2026-08-26')[0], 'medium-literature-balanced');
  assert.equal(getRotatedProfileIds('2026-08-27')[0], 'beginner-geography-compact');
  assert.equal(addDaysToIsoDate('2028-02-28', 1), '2028-02-29');
});

test('builds a deterministic seven-day quality-approved schedule', () => {
  const request = {
    dayCount: 7,
    revision: 'schedule-v1',
    startDate: '2026-08-24',
  };
  const firstSchedule = createDailyPublicationSchedule(catalog, request);
  const secondSchedule = createDailyPublicationSchedule(catalog, request);

  assert.deepEqual(firstSchedule, secondSchedule);
  assert.equal(firstSchedule.length, 7);
  assert.equal(new Set(firstSchedule.map(({ date }) => date)).size, 7);
  assert.ok(firstSchedule.every(({ quality }) => quality.passed));
  assert.deepEqual(
    firstSchedule.map(({ profileId }) => profileId),
    [
      'beginner-geography-compact',
      'easy-mixed-wide',
      'medium-literature-balanced',
      'beginner-geography-compact',
      'easy-mixed-wide',
      'medium-literature-balanced',
      'beginner-geography-compact',
    ],
  );
});

test('retries a failed deterministic seed before changing profile', () => {
  let attemptCount = 0;
  const publication = createScheduledDailyPublication(
    catalog,
    { date: '2026-08-24', revision: 'schedule-v1' },
    {
      publicationFactory: (entries, request) => {
        attemptCount += 1;

        if (attemptCount < 3) {
          throw new Error('Synthetic fill failure.');
        }

        return {
          date: request.date,
          profileId: request.profileId,
          revision: request.revision,
        };
      },
    },
  );

  assert.equal(attemptCount, 3);
  assert.equal(publication.profileId, 'beginner-geography-compact');
  assert.equal(publication.revision, 'schedule-v1-a3');
});
