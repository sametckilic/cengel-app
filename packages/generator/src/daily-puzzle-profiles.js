const {
  NEWSPAPER_V2_RECIPE_MATRIX,
} = require('./newspaper-recipe-matrix');

const LEGACY_DAILY_PUZZLE_PROFILES = {
  'beginner-geography-compact': Object.freeze({
    title: 'Günün Bulmacası',
    topologyId: 'newspaper-beginner-7x7-v1',
    difficulty: 'beginner',
    categories: Object.freeze(['cografya']),
    categoryWeight: 0.58,
  }),
  'easy-mixed-wide': Object.freeze({
    title: 'Günün Bulmacası',
    topologyId: 'newspaper-9x10-v1',
    difficulty: 'easy',
    categories: Object.freeze(['turkce', 'genel_kultur']),
    categoryWeight: 0.6,
  }),
  'medium-literature-balanced': Object.freeze({
    title: 'Günün Bulmacası',
    topologyId: 'newspaper-medium-8x8-v1',
    difficulty: 'medium',
    categories: Object.freeze(['edebiyat']),
    categoryWeight: 0.53,
  }),
};
const DAILY_PUZZLE_PROFILES = Object.freeze({
  ...LEGACY_DAILY_PUZZLE_PROFILES,
  ...Object.fromEntries(
    NEWSPAPER_V2_RECIPE_MATRIX.map(({ profileId, ...profile }) => [
      profileId,
      Object.freeze(profile),
    ]),
  ),
});

function getDailyPuzzleProfile(profileId) {
  const profile = DAILY_PUZZLE_PROFILES[profileId];

  if (!profile) {
    throw new Error(
      `Unsupported daily puzzle profile: ${profileId}. ` +
        `Available profiles: ${Object.keys(DAILY_PUZZLE_PROFILES).join(', ')}`,
    );
  }

  return { ...profile, categories: [...profile.categories] };
}

module.exports = {
  DAILY_PUZZLE_PROFILES,
  getDailyPuzzleProfile,
};
