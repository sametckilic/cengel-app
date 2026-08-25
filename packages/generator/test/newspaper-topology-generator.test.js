const assert = require('node:assert/strict');
const test = require('node:test');

const {
  generateNewspaperTopologyCandidates,
} = require('../src/newspaper-topology-generator');
const { validateNewspaperTopology } = require('../src/newspaper-topology');

const rectangularRequest = {
  columnCount: 10,
  rowCount: 9,
  seed: 'topology-preview-a',
  targetWordCount: 25,
};

test('generates deterministic aesthetic topology candidates for a rectangular grid', () => {
  const first = generateNewspaperTopologyCandidates(rectangularRequest, {
    beamWidth: 400,
    maxCandidates: 4,
    maxMutationDepth: 4,
  });
  const second = generateNewspaperTopologyCandidates(rectangularRequest, {
    beamWidth: 400,
    maxCandidates: 4,
    maxMutationDepth: 4,
  });

  assert.deepEqual(
    first.candidates.map(({ fingerprint }) => fingerprint),
    second.candidates.map(({ fingerprint }) => fingerprint),
  );
  assert.ok(first.candidates.length > 1);
  assert.ok(first.diagnostics.discoveredCandidateCount >= first.candidates.length);

  for (const candidate of first.candidates) {
    assert.equal(candidate.aesthetic.passed, true);
    assert.equal(candidate.topology.rowCount, rectangularRequest.rowCount);
    assert.equal(candidate.topology.columnCount, rectangularRequest.columnCount);
    assert.equal(candidate.topology.slots.length, rectangularRequest.targetWordCount);
    assert.doesNotThrow(() => validateNewspaperTopology(candidate.topology));
  }
});

test('uses the seed to choose a different candidate order from the quality window', () => {
  const first = generateNewspaperTopologyCandidates(rectangularRequest, {
    beamWidth: 400,
    maxCandidates: 4,
    maxMutationDepth: 4,
  });
  const second = generateNewspaperTopologyCandidates(
    { ...rectangularRequest, seed: 'topology-preview-b' },
    {
      beamWidth: 400,
      maxCandidates: 4,
      maxMutationDepth: 4,
    },
  );

  assert.notDeepEqual(
    first.candidates.map(({ fingerprint }) => fingerprint),
    second.candidates.map(({ fingerprint }) => fingerprint),
  );
});

test('supports a compact non-square-independent topology family', () => {
  const result = generateNewspaperTopologyCandidates(
    {
      columnCount: 7,
      rowCount: 7,
      seed: 'compact-preview',
      targetWordCount: 14,
    },
    {
      beamWidth: 1_000,
      maxCandidates: 2,
      maxMutationDepth: 5,
    },
  );

  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.every(({ aesthetic }) => aesthetic.passed));
  assert.ok(result.candidates.every(({ topology }) => topology.slots.length === 14));
});

test('supports large square and rectangular topology families without mutation', () => {
  const requests = [
    { columnCount: 10, rowCount: 10, targetWordCount: 29 },
    { columnCount: 12, rowCount: 10, targetWordCount: 39 },
  ];

  for (const request of requests) {
    const result = generateNewspaperTopologyCandidates(
      { ...request, seed: `large-${request.rowCount}x${request.columnCount}` },
      { maxCandidates: 1, maxMutationDepth: 0 },
    );

    assert.equal(result.candidates.length, 1);
    assert.equal(result.candidates[0].mutationDepth, 0);
    assert.equal(result.candidates[0].aesthetic.passed, true);
    assert.equal(result.candidates[0].topology.slots.length, request.targetWordCount);
  }
});

test('fails descriptively for an unsupported topology family', () => {
  assert.throws(
    () =>
      generateNewspaperTopologyCandidates({
        columnCount: 11,
        rowCount: 6,
        seed: 'unsupported',
        targetWordCount: 12,
      }),
    /No newspaper topology family supports 6x11/,
  );
});
