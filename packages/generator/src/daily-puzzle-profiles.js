const DAILY_PUZZLE_PROFILES = Object.freeze({
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
  'v2-beginner-geography-compact': Object.freeze({
    title: 'Günün Bulmacası',
    generatorVersion: 'newspaper-v2',
    rowCount: 7,
    columnCount: 7,
    targetWordCount: 14,
    difficulty: 'beginner',
    categories: Object.freeze(['cografya', 'yer', 'turkce']),
    categoryWeight: 0.6,
  }),
  'v2-medium-culture-balanced': Object.freeze({
    title: 'Günün Bulmacası',
    generatorVersion: 'newspaper-v2',
    rowCount: 8,
    columnCount: 8,
    targetWordCount: 15,
    difficulty: 'medium',
    categories: Object.freeze(['edebiyat', 'sanat', 'tarih']),
    categoryWeight: 0.55,
  }),
  'v2-easy-science-wide': Object.freeze({
    title: 'Günün Bulmacası',
    generatorVersion: 'newspaper-v2',
    rowCount: 9,
    columnCount: 10,
    targetWordCount: 25,
    difficulty: 'easy',
    categories: Object.freeze(['bilim', 'teknoloji', 'genel_kultur']),
    categoryWeight: 0.6,
  }),
  'v2-easy-history-large': Object.freeze({
    title: 'Günün Bulmacası',
    generatorVersion: 'newspaper-v2',
    rowCount: 10,
    columnCount: 10,
    targetWordCount: 29,
    difficulty: 'easy',
    categories: Object.freeze(['tarih', 'cografya', 'genel_kultur', 'turkce']),
    categoryWeight: 0.55,
  }),
  'v2-easy-technology-large': Object.freeze({
    title: 'Günün Bulmacası',
    generatorVersion: 'newspaper-v2',
    rowCount: 10,
    columnCount: 12,
    targetWordCount: 39,
    difficulty: 'easy',
    categories: Object.freeze(['bilim', 'teknoloji', 'genel_kultur', 'turkce']),
    categoryWeight: 0.55,
  }),
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
