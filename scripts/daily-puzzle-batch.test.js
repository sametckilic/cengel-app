const assert = require('node:assert/strict');
const test = require('node:test');

const catalog = require('../apps/mobile/data/generated/clue-catalog.json');
const { createPublicationBatch, parseArguments } = require('./publish-daily-puzzles');
const {
  createDailyPublicationSchedule,
  filterPublicationsAvailableOn,
  getDateKeyInTimeZone,
  resolveScheduleDate,
} = require('./lib/daily-puzzle-schedule');

test('resolves schedule dates in the Istanbul calendar', () => {
  assert.equal(
    getDateKeyInTimeZone(new Date('2026-08-23T21:30:00.000Z')),
    '2026-08-24',
  );
  assert.equal(resolveScheduleDate('today', '2026-08-23'), '2026-08-23');
  assert.equal(resolveScheduleDate('tomorrow', '2026-08-23'), '2026-08-24');
});

test('keeps future publications out of the visible manifest input', () => {
  const publications = createDailyPublicationSchedule(catalog, {
    dayCount: 3,
    revision: 'schedule-v1',
    startDate: '2026-08-23',
  });
  const available = filterPublicationsAvailableOn(publications, '2026-08-24');

  assert.deepEqual(
    available.map(({ date }) => date),
    ['2026-08-23', '2026-08-24'],
  );
});

test('requires an explicit check or publish mode for batch generation', () => {
  const options = parseArguments([
    '--start',
    'tomorrow',
    '--days',
    '7',
    '--revision',
    'schedule-v1',
    '--as-of',
    '2026-08-23',
    '--check',
  ]);

  assert.equal(options.startDate, '2026-08-24');
  assert.equal(options.dayCount, 7);
  assert.equal(options.checkOnly, true);
  assert.equal(options.publish, false);
  assert.throws(
    () =>
      parseArguments([
        '--start',
        'today',
        '--days',
        '7',
        '--revision',
        'schedule-v1',
      ]),
    /either --check or --publish/,
  );
});

test('keeps an already prepared future publication stable', () => {
  const existing = createDailyPublicationSchedule(catalog, {
    dayCount: 1,
    revision: 'original-v1',
    startDate: '2026-08-24',
  });
  const batch = createPublicationBatch(
    catalog,
    {
      dayCount: 2,
      revision: 'schedule-v2',
      startDate: '2026-08-24',
    },
    existing,
  );

  assert.equal(batch[0], existing[0]);
  assert.equal(batch[0].revision, 'original-v1-a1');
  assert.equal(batch[1].date, '2026-08-25');
  assert.equal(batch[1].revision, 'schedule-v2-a1');
});
