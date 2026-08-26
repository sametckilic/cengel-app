const { createDailyPuzzlePublication } = require('./daily-puzzle-publication');
const { validateIsoDate } = require('./daily-puzzle-recipe');
const {
  NEWSPAPER_V2_RECIPE_MATRIX,
} = require('./newspaper-recipe-matrix');

const ROTATION_ANCHOR_DATE = '2026-08-24';
const DAILY_PROFILE_ROTATION = Object.freeze([
  'beginner-geography-compact',
  'easy-mixed-wide',
  'medium-literature-balanced',
]);
const DAILY_V2_PROFILE_ROTATION = Object.freeze(
  NEWSPAPER_V2_RECIPE_MATRIX.map(({ profileId }) => profileId),
);
const DAILY_PROFILE_ROTATIONS = Object.freeze({
  'newspaper-v1': DAILY_PROFILE_ROTATION,
  'newspaper-v2': DAILY_V2_PROFILE_ROTATION,
});
const DEFAULT_MAX_ATTEMPTS_PER_PROFILE = 5;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function parseUtcDate(date) {
  validateIsoDate(date);
  return new Date(`${date}T00:00:00.000Z`);
}

function addDaysToIsoDate(date, dayOffset) {
  if (!Number.isInteger(dayOffset)) {
    throw new Error('Daily puzzle day offset must be an integer.');
  }

  const parsedDate = parseUtcDate(date);
  parsedDate.setUTCDate(parsedDate.getUTCDate() + dayOffset);
  return parsedDate.toISOString().slice(0, 10);
}

function getDateKeyInTimeZone(date = new Date(), timeZone = 'Europe/Istanbul') {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone,
    year: 'numeric',
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function resolveScheduleDate(value, today = getDateKeyInTimeZone()) {
  validateIsoDate(today);

  if (value === 'today') {
    return today;
  }

  if (value === 'tomorrow') {
    return addDaysToIsoDate(today, 1);
  }

  return validateIsoDate(value);
}

function filterPublicationsAvailableOn(publications, asOfDate) {
  validateIsoDate(asOfDate);

  if (!Array.isArray(publications)) {
    throw new Error('Daily publications must be an array.');
  }

  return publications
    .filter((publication) => {
      validateIsoDate(publication?.date);
      return publication.date <= asOfDate;
    })
    .sort((left, right) => left.date.localeCompare(right.date));
}

function getRotatedProfileIds(date, generatorVersion = 'newspaper-v1') {
  const profileRotation = DAILY_PROFILE_ROTATIONS[generatorVersion];

  if (!profileRotation) {
    throw new Error(`Unsupported daily generator version: ${generatorVersion}`);
  }

  const dayDifference = Math.round(
    (parseUtcDate(date).getTime() - parseUtcDate(ROTATION_ANCHOR_DATE).getTime()) /
      MILLISECONDS_PER_DAY,
  );
  const rotationIndex =
    ((dayDifference % profileRotation.length) + profileRotation.length) %
    profileRotation.length;

  return [
    ...profileRotation.slice(rotationIndex),
    ...profileRotation.slice(0, rotationIndex),
  ];
}

function createScheduledDailyPublication(
  catalog,
  { date, revision },
  options = {},
) {
  validateIsoDate(date);

  if (typeof revision !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(revision)) {
    throw new Error('Daily schedule revision must be a lowercase slug.');
  }

  const maxAttemptsPerProfile =
    options.maxAttemptsPerProfile ?? DEFAULT_MAX_ATTEMPTS_PER_PROFILE;
  const publicationFactory =
    options.publicationFactory ?? createDailyPuzzlePublication;
  const generatorVersion = options.generatorVersion ?? 'newspaper-v1';

  if (!Number.isInteger(maxAttemptsPerProfile) || maxAttemptsPerProfile < 1) {
    throw new Error('maxAttemptsPerProfile must be a positive integer.');
  }

  const failures = [];

  for (const profileId of getRotatedProfileIds(date, generatorVersion)) {
    for (let attempt = 1; attempt <= maxAttemptsPerProfile; attempt += 1) {
      const attemptRevision = `${revision}-a${attempt}`;

      try {
        return publicationFactory(catalog, {
          date,
          profileId,
          revision: attemptRevision,
        });
      } catch (error) {
        failures.push(
          `${profileId}/${attemptRevision}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  throw new Error(
    `Could not produce a quality-approved daily puzzle for ${date}. ${failures.join(' | ')}`,
  );
}

function createDailyPublicationSchedule(
  catalog,
  { dayCount, revision, startDate },
  options,
) {
  validateIsoDate(startDate);

  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 31) {
    throw new Error('Daily schedule dayCount must be an integer between 1 and 31.');
  }

  return Array.from({ length: dayCount }, (_, dayOffset) =>
    createScheduledDailyPublication(
      catalog,
      {
        date: addDaysToIsoDate(startDate, dayOffset),
        revision,
      },
      options,
    ),
  );
}

module.exports = {
  DAILY_PROFILE_ROTATION,
  DAILY_PROFILE_ROTATIONS,
  DAILY_V2_PROFILE_ROTATION,
  DEFAULT_MAX_ATTEMPTS_PER_PROFILE,
  ROTATION_ANCHOR_DATE,
  addDaysToIsoDate,
  createDailyPublicationSchedule,
  createScheduledDailyPublication,
  filterPublicationsAvailableOn,
  getDateKeyInTimeZone,
  getRotatedProfileIds,
  resolveScheduleDate,
};
