const NEWSPAPER_V2_DIFFICULTIES = Object.freeze([
  'beginner',
  'easy',
  'medium',
  'hard',
]);
const NEWSPAPER_V2_SIZE_VARIANTS = Object.freeze([
  Object.freeze({
    columnCount: 7,
    rowCount: 7,
    targetWordCount: 14,
    profileSuffix: 'geography-compact',
    categories: Object.freeze(['cografya', 'yer', 'turkce']),
    categoryWeight: 0.6,
  }),
  Object.freeze({
    columnCount: 8,
    rowCount: 8,
    targetWordCount: 15,
    profileSuffix: 'culture-balanced',
    categories: Object.freeze(['edebiyat', 'sanat', 'tarih']),
    categoryWeight: 0.55,
  }),
  Object.freeze({
    columnCount: 10,
    rowCount: 9,
    targetWordCount: 25,
    profileSuffix: 'science-wide',
    categories: Object.freeze(['bilim', 'teknoloji', 'genel_kultur']),
    categoryWeight: 0.6,
  }),
  Object.freeze({
    columnCount: 10,
    rowCount: 10,
    targetWordCount: 29,
    profileSuffix: 'history-large',
    categories: Object.freeze([
      'tarih',
      'cografya',
      'genel_kultur',
      'turkce',
    ]),
    categoryWeight: 0.55,
  }),
  Object.freeze({
    columnCount: 12,
    rowCount: 10,
    targetWordCount: 39,
    profileSuffix: 'technology-large',
    categories: Object.freeze([
      'bilim',
      'teknoloji',
      'genel_kultur',
      'turkce',
    ]),
    categoryWeight: 0.55,
  }),
]);

function createMatrixEntry(sizeVariant, difficulty) {
  return Object.freeze({
    categories: sizeVariant.categories,
    categoryWeight: sizeVariant.categoryWeight,
    columnCount: sizeVariant.columnCount,
    difficulty,
    generatorVersion: 'newspaper-v2',
    profileId: `v2-${difficulty}-${sizeVariant.profileSuffix}`,
    rowCount: sizeVariant.rowCount,
    targetWordCount: sizeVariant.targetWordCount,
    title: 'Günün Bulmacası',
  });
}

// Five sizes and four difficulties are coprime cycles. Advancing both on each
// publication visits every matrix cell once while varying consecutive days.
const NEWSPAPER_V2_RECIPE_MATRIX = Object.freeze(
  Array.from(
    {
      length:
        NEWSPAPER_V2_SIZE_VARIANTS.length *
        NEWSPAPER_V2_DIFFICULTIES.length,
    },
    (_, index) =>
      createMatrixEntry(
        NEWSPAPER_V2_SIZE_VARIANTS[index % NEWSPAPER_V2_SIZE_VARIANTS.length],
        NEWSPAPER_V2_DIFFICULTIES[index % NEWSPAPER_V2_DIFFICULTIES.length],
      ),
  ),
);

module.exports = {
  NEWSPAPER_V2_DIFFICULTIES,
  NEWSPAPER_V2_RECIPE_MATRIX,
  NEWSPAPER_V2_SIZE_VARIANTS,
};
