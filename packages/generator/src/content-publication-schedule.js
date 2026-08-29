const {
  createContentPuzzlePublication,
} = require('./daily-puzzle-publication');
const { validateIsoDate } = require('./daily-puzzle-recipe');

const CONTENT_PLAN_REVISION = 'content-v1';
const CONTENT_RELEASE_DATE = '2026-08-29';
const DEFAULT_MAX_ATTEMPTS = 5;

function freezeProfile(profile) {
  return Object.freeze({
    ...profile,
    categories: Object.freeze([...profile.categories]),
  });
}

const CONTENT_PUBLICATION_PLAN = Object.freeze([
  Object.freeze({
    channel: 'archive',
    profile: freezeProfile({
      categories: ['cografya', 'yer', 'turkce'],
      categoryWeight: 0.6,
      columnCount: 7,
      difficulty: 'beginner',
      generatorVersion: 'newspaper-v2',
      rowCount: 7,
      targetWordCount: 18,
    }),
    profileId: 'content-v1-beginner-geography-compact',
    publicationDate: CONTENT_RELEASE_DATE,
    puzzleId: 'arsiv-baslangic-001',
    revision: CONTENT_PLAN_REVISION,
    seed:
      'arsiv-baslangic-001:content-v1-a1:newspaper-v2-7x7-18:beginner:cografya+yer+turkce:0.6',
    title: 'Arşiv: Başlangıç',
  }),
  Object.freeze({
    channel: 'archive',
    profile: freezeProfile({
      categories: ['bilim', 'teknoloji', 'genel_kultur'],
      categoryWeight: 0.6,
      columnCount: 10,
      difficulty: 'easy',
      generatorVersion: 'newspaper-v2',
      rowCount: 9,
      targetWordCount: 29,
    }),
    profileId: 'content-v1-easy-science-wide',
    publicationDate: CONTENT_RELEASE_DATE,
    puzzleId: 'arsiv-kolay-001',
    revision: CONTENT_PLAN_REVISION,
    seed: 'arsiv-kolay-001:content-v1-a1',
    title: 'Arşiv: Bilim ve Teknoloji',
  }),
  Object.freeze({
    channel: 'pack',
    packId: 'kultur-sanat',
    profile: freezeProfile({
      categories: ['edebiyat', 'sanat', 'tarih'],
      categoryWeight: 0.55,
      columnCount: 7,
      difficulty: 'easy',
      generatorVersion: 'newspaper-v2',
      rowCount: 7,
      targetWordCount: 18,
    }),
    profileId: 'content-v1-easy-culture-compact',
    publicationDate: CONTENT_RELEASE_DATE,
    puzzleId: 'kultur-sanat-001',
    puzzleNumber: 1,
    revision: CONTENT_PLAN_REVISION,
    seed:
      'kultur-sanat-001:content-v1-a1:newspaper-v2-7x7-18:easy:edebiyat+sanat+tarih:0.55',
    title: 'Kültür ve Sanat I',
  }),
  Object.freeze({
    channel: 'pack',
    packId: 'kultur-sanat',
    profile: freezeProfile({
      categories: ['edebiyat', 'sanat', 'tarih'],
      categoryWeight: 0.55,
      columnCount: 8,
      difficulty: 'medium',
      generatorVersion: 'newspaper-v2',
      rowCount: 8,
      targetWordCount: 23,
    }),
    profileId: 'content-v1-medium-culture-balanced',
    publicationDate: CONTENT_RELEASE_DATE,
    puzzleId: 'kultur-sanat-002',
    puzzleNumber: 2,
    revision: CONTENT_PLAN_REVISION,
    seed:
      'kultur-sanat-002:content-v1-a1:newspaper-v2-8x8-23:medium:edebiyat+sanat+tarih:0.55',
    title: 'Kültür ve Sanat II',
  }),
]);

function validatePlanItem(item) {
  validateIsoDate(item?.publicationDate);

  if (item?.channel !== 'archive' && item?.channel !== 'pack') {
    throw new Error('Content publication channel must be archive or pack.');
  }

  if (typeof item.profileId !== 'string' || item.profileId.length === 0) {
    throw new Error('Content publication profileId is required.');
  }

  for (const [label, value] of [
    ['puzzle ID', item.puzzleId],
    ['revision', item.revision],
  ]) {
    if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]*$/.test(value)) {
      throw new Error(`Content publication ${label} must be a lowercase slug.`);
    }
  }

  if (typeof item.seed !== 'string' || item.seed.length === 0) {
    throw new Error('Content publication seed is required.');
  }

  if (typeof item.title !== 'string' || item.title.trim().length === 0) {
    throw new Error('Content publication title is required.');
  }

  if (item.channel === 'pack') {
    if (
      typeof item.packId !== 'string' ||
      !/^[a-z0-9][a-z0-9-]*$/.test(item.packId)
    ) {
      throw new Error('Content pack ID must be a lowercase slug.');
    }

    if (!Number.isSafeInteger(item.puzzleNumber) || item.puzzleNumber < 1) {
      throw new Error('Content pack puzzleNumber must be a positive integer.');
    }
  }
}

function createScheduledContentPublication(catalog, item, options = {}) {
  validatePlanItem(item);
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const publicationFactory =
    options.publicationFactory ?? createContentPuzzlePublication;

  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1) {
    throw new Error('Content maxAttempts must be a positive integer.');
  }

  const failures = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const revision = `${item.revision}-a${attempt}`;

    try {
      return publicationFactory(catalog, {
        date: item.publicationDate,
        profile: item.profile,
        profileId: item.profileId,
        puzzleId: item.puzzleId,
        revision,
        seed: attempt === 1 ? item.seed : `${item.seed}:retry-${attempt}`,
        title: item.title,
      });
    } catch (error) {
      failures.push(
        `${revision}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  throw new Error(
    `Could not produce quality-approved content puzzle "${item.puzzleId}". ` +
      failures.join(' | '),
  );
}

module.exports = {
  CONTENT_PLAN_REVISION,
  CONTENT_PUBLICATION_PLAN,
  CONTENT_RELEASE_DATE,
  DEFAULT_MAX_ATTEMPTS,
  createScheduledContentPublication,
};
