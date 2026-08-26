const assert = require('node:assert/strict');
const test = require('node:test');

const {
  evaluateNewspaperTopologyAesthetics,
  resolveAestheticPolicy,
} = require('../src/newspaper-aesthetics');
const {
  createNewspaper9x10Topology,
  createNewspaperArrowwordTopology,
  createNewspaperBeginner7x7Topology,
  createNewspaperMedium8x8Topology,
  createNewspaperTopology,
  createNewspaperPrototypeTopology,
} = require('../src/newspaper-topology');

test('reports local newspaper-layout weaknesses in the current topology library', () => {
  const reports = [
    createNewspaperPrototypeTopology(),
    createNewspaper9x10Topology(),
    createNewspaperBeginner7x7Topology(),
    createNewspaperMedium8x8Topology(),
  ].map((topology) => ({
    id: topology.id,
    report: evaluateNewspaperTopologyAesthetics(topology),
  }));

  assert.ok(reports.every(({ report }) => !report.passed));
  assert.deepEqual(
    reports.map(({ id, report }) => ({
      columnDownCoverage: report.metrics.columnDownCoverage,
      id,
      singleRightSlotRowShare: report.metrics.singleRightSlotRowShare,
      topRowRightSlotLengths: report.metrics.topRowRightSlotLengths,
    })),
    [
      {
        columnDownCoverage: 0.625,
        id: 'newspaper-8x8-v2',
        singleRightSlotRowShare: 0.875,
        topRowRightSlotLengths: [5],
      },
      {
        columnDownCoverage: 0.7,
        id: 'newspaper-9x10-v1',
        singleRightSlotRowShare: 0.4444,
        topRowRightSlotLengths: [5, 2],
      },
      {
        columnDownCoverage: 0.5714,
        id: 'newspaper-beginner-7x7-v1',
        singleRightSlotRowShare: 1,
        topRowRightSlotLengths: [4],
      },
      {
        columnDownCoverage: 0.625,
        id: 'newspaper-medium-8x8-v1',
        singleRightSlotRowShare: 1,
        topRowRightSlotLengths: [6],
      },
    ],
  );
});

test('rejects a straight-only layout even when its former row metrics are balanced', () => {
  const topology = createNewspaperTopology('balanced-9x10-fixture', [
    '##..#..#..',
    '.#...#...#',
    '.##.......',
    '..#.......',
    '#.##...#..',
    '.#.......#',
    '...#......',
    '#....#....',
    '#....#....',
  ]);
  const report = evaluateNewspaperTopologyAesthetics(topology);

  assert.equal(report.passed, false);
  assert.ok(report.issues.some((issue) => issue.includes('Bent-arrow share')));
  assert.deepEqual(report.metrics.topRowRightSlotLengths, [2, 2, 2]);
  assert.equal(report.metrics.columnDownCoverage, 0.8);
});

test('accepts a scattered arrowword layout with independently bent starts', () => {
  const topology = createNewspaperArrowwordTopology(
    'scattered-8x8-fixture',
    [
      '##....#.',
      '........',
      '.#.#..##',
      '#.......',
      '........',
      '...#....',
      '#..#....',
      '...#....',
    ],
    'scattered-aesthetic-test',
  );
  const report = evaluateNewspaperTopologyAesthetics(topology);

  assert.equal(report.passed, true);
  assert.ok(report.metrics.clueRowCoverage >= 0.5);
  assert.ok(report.metrics.clueColumnCoverage >= 0.5);
  assert.ok(report.metrics.bentArrowShare >= 0.1);
  assert.ok(report.metrics.interiorClueShare >= 0.3);
});

test('rejects invalid aesthetic policy ranges', () => {
  assert.throws(
    () => resolveAestheticPolicy({ minimumClueDensity: 0.4, maximumClueDensity: 0.3 }),
    /minimumClueDensity cannot be greater/,
  );
  assert.throws(
    () => resolveAestheticPolicy({ maximumConsecutiveDominantSingleRightRows: 1.5 }),
    /must be a non-negative integer/,
  );
});
