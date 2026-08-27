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

function assertHasBentArrowPair(topology) {
  const arrows = topology.slots.map(({ arrow, direction }) => arrow ?? direction);

  assert.ok(arrows.includes('right-down'));
  assert.ok(arrows.includes('down-right'));
}

function assertHasIndependentBentArrow(topology) {
  const startUseCount = topology.slots.reduce((counts, slot) => {
    const firstCellIndex = slot.cellIndices[0];
    counts.set(firstCellIndex, (counts.get(firstCellIndex) ?? 0) + 1);
    return counts;
  }, new Map());

  assert.ok(
    topology.slots.some(
      ({ arrow, cellIndices, direction }) =>
        arrow !== undefined &&
        arrow !== direction &&
        startUseCount.get(cellIndices[0]) === 1,
    ),
  );
}

function assertHasBoundaryScaffold(aesthetic) {
  assert.equal(aesthetic.metrics.hasTopLeftScaffoldPair, true);
  assert.ok(aesthetic.metrics.topEdgeBentDownCount >= 3);
  assert.ok(aesthetic.metrics.leftEdgeBentRightCount >= 3);
  assert.ok(aesthetic.metrics.topEdgeScaffoldSpan >= 0.55);
  assert.ok(aesthetic.metrics.leftEdgeScaffoldSpan >= 0.6);
  assert.ok(aesthetic.metrics.interiorStraightSplitCount >= 2);
  assert.ok(aesthetic.metrics.topRowRightSlotCount <= 1);
}

test('generates deterministic aesthetic topology candidates for a rectangular grid', () => {
  const first = generateNewspaperTopologyCandidates(rectangularRequest, {
    beamWidth: 200,
    maxCandidates: 4,
    maxMutationDepth: 1,
  });
  const second = generateNewspaperTopologyCandidates(rectangularRequest, {
    beamWidth: 200,
    maxCandidates: 4,
    maxMutationDepth: 1,
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
    assertHasBentArrowPair(candidate.topology);
    assertHasIndependentBentArrow(candidate.topology);
    assertHasBoundaryScaffold(candidate.aesthetic);
    assert.doesNotThrow(() => validateNewspaperTopology(candidate.topology));
  }
});

test('uses the seed to choose a different candidate order from the quality window', () => {
  const first = generateNewspaperTopologyCandidates(rectangularRequest, {
    beamWidth: 200,
    maxCandidates: 4,
    maxMutationDepth: 1,
  });
  const second = generateNewspaperTopologyCandidates(
    { ...rectangularRequest, seed: 'topology-preview-b' },
    {
      beamWidth: 200,
      maxCandidates: 4,
      maxMutationDepth: 1,
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
      beamWidth: 200,
      maxCandidates: 2,
      maxMutationDepth: 1,
    },
  );

  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.every(({ aesthetic }) => aesthetic.passed));
  assert.ok(result.candidates.every(({ topology }) => topology.slots.length === 14));
  result.candidates.forEach(({ aesthetic, topology }) => {
    assertHasBentArrowPair(topology);
    assertHasBoundaryScaffold(aesthetic);
  });
});

test('supports a dense 8x8 topology with newspaper-style bent arrows', () => {
  const result = generateNewspaperTopologyCandidates(
    {
      columnCount: 8,
      rowCount: 8,
      seed: 'balanced-bent-preview',
      targetWordCount: 18,
    },
    {
      beamWidth: 200,
      maxCandidates: 2,
      maxMutationDepth: 1,
    },
  );

  assert.ok(result.candidates.length >= 1);
  assert.ok(result.candidates.every(({ aesthetic }) => aesthetic.passed));
  assert.ok(result.candidates.every(({ topology }) => topology.slots.length === 18));
  result.candidates.forEach(({ aesthetic, topology }) => {
    assertHasBentArrowPair(topology);
    assertHasBoundaryScaffold(aesthetic);
  });
});

test('supports large square and rectangular topology families without mutation', () => {
  const requests = [
    { columnCount: 10, rowCount: 10, targetWordCount: 29 },
    { columnCount: 12, rowCount: 10, targetWordCount: 32 },
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
    assertHasBentArrowPair(result.candidates[0].topology);
    assertHasBoundaryScaffold(result.candidates[0].aesthetic);
  }
});

test('keeps a fill-resilient large topology alternative for sparse difficulty pools', () => {
  const result = generateNewspaperTopologyCandidates(
    {
      columnCount: 12,
      rowCount: 10,
      seed: 'large-10x12-resilient',
      targetWordCount: 32,
    },
    { maxCandidates: 2, maxMutationDepth: 0 },
  );

  assert.equal(result.candidates.length, 2);
  assert.ok(result.candidates.every(({ mutationDepth }) => mutationDepth === 0));
  assert.ok(result.candidates.every(({ aesthetic }) => aesthetic.passed));
  assert.ok(result.candidates.every(({ topology }) => topology.slots.length === 32));
  result.candidates.forEach(({ aesthetic }) => assertHasBoundaryScaffold(aesthetic));
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
