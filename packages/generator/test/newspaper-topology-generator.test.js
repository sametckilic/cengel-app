const assert = require('node:assert/strict');
const test = require('node:test');

const {
  createAlternatingBoundaryIndices,
  evaluateCanonicalNewspaperLayout,
} = require('../src/newspaper-canonical-layout');
const {
  generateNewspaperTopologyCandidates,
} = require('../src/newspaper-topology-generator');
const { validateNewspaperTopology } = require('../src/newspaper-topology');

const rectangularRequest = {
  columnCount: 10,
  rowCount: 9,
  seed: 'topology-preview-a',
  targetWordCount: 29,
};

function assertCanonicalCandidate(candidate, request) {
  const canonical = evaluateCanonicalNewspaperLayout(candidate.topology);

  assert.equal(candidate.canonical.passed, true);
  assert.equal(canonical.passed, true);
  assert.deepEqual(
    canonical.metrics.topClueColumns,
    createAlternatingBoundaryIndices(request.columnCount),
  );
  assert.deepEqual(
    canonical.metrics.leftClueRows,
    createAlternatingBoundaryIndices(request.rowCount),
  );
  assert.equal(canonical.metrics.topRowRightSlotCount, 0);
  assert.equal(canonical.metrics.leftColumnDownSlotCount, 0);
  assert.ok(
    canonical.metrics.interiorStraightSplitCount >=
      canonical.policy.minimumInteriorStraightSplitCount,
  );
  assert.equal(candidate.topology.rowCount, request.rowCount);
  assert.equal(candidate.topology.columnCount, request.columnCount);
  assert.equal(candidate.topology.slots.length, request.targetWordCount);
  assert.ok(candidate.topology.cells.every(({ type }) => type !== 'void'));
  assert.doesNotThrow(() => validateNewspaperTopology(candidate.topology));
}

test('generates deterministic outside-in canonical candidates', () => {
  const options = { maxCandidates: 4, maxPatternAttempts: 20_000 };
  const first = generateNewspaperTopologyCandidates(rectangularRequest, options);
  const second = generateNewspaperTopologyCandidates(rectangularRequest, options);

  assert.deepEqual(first, second);
  assert.equal(first.diagnostics.generationMode, 'outside-in-canonical');
  assert.equal(first.candidates.length, 4);
  first.candidates.forEach((candidate) =>
    assertCanonicalCandidate(candidate, rectangularRequest),
  );
});

test('uses the seed to derive a different canonical layout family', () => {
  const options = { maxCandidates: 3, maxPatternAttempts: 20_000 };
  const first = generateNewspaperTopologyCandidates(rectangularRequest, options);
  const second = generateNewspaperTopologyCandidates(
    { ...rectangularRequest, seed: 'topology-preview-b' },
    options,
  );

  assert.notDeepEqual(
    first.candidates.map(({ fingerprint }) => fingerprint),
    second.candidates.map(({ fingerprint }) => fingerprint),
  );
});

test('supports every configured size with its natural newspaper density', () => {
  const requests = [
    { columnCount: 7, rowCount: 7, targetWordCount: 18 },
    { columnCount: 8, rowCount: 8, targetWordCount: 23 },
    { columnCount: 10, rowCount: 9, targetWordCount: 29 },
    { columnCount: 10, rowCount: 10, targetWordCount: 32 },
    { columnCount: 12, rowCount: 10, targetWordCount: 40 },
  ];

  for (const request of requests) {
    const seededRequest = {
      ...request,
      seed: `configured-${request.rowCount}x${request.columnCount}`,
    };
    const result = generateNewspaperTopologyCandidates(seededRequest, {
      maxCandidates: 1,
      maxPatternAttempts: 30_000,
    });

    assert.equal(result.candidates.length, 1);
    assertCanonicalCandidate(result.candidates[0], seededRequest);
  }
});

test('supports dimensions outside the preview matrix', () => {
  const request = {
    columnCount: 11,
    rowCount: 6,
    seed: 'variable-6x11',
    targetWordCount: 21,
  };
  const result = generateNewspaperTopologyCandidates(request, {
    maxCandidates: 1,
    maxPatternAttempts: 20_000,
  });

  assert.equal(result.candidates.length, 1);
  assertCanonicalCandidate(result.candidates[0], request);
});

test('fails descriptively when the requested density cannot be produced', () => {
  assert.throws(
    () =>
      generateNewspaperTopologyCandidates(
        {
          columnCount: 11,
          rowCount: 6,
          seed: 'impossible-density',
          targetWordCount: 1,
        },
        { maxPatternAttempts: 100 },
      ),
    /Could not generate a canonical 6x11 newspaper topology with 1 words/,
  );
});
