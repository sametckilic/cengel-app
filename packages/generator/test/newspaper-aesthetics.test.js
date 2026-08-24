const assert = require('node:assert/strict');
const test = require('node:test');

const {
  evaluateNewspaperTopologyAesthetics,
  resolveAestheticPolicy,
} = require('../src/newspaper-aesthetics');
const {
  createNewspaper9x10Topology,
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

test('accepts a balanced topology with a varied top row under the default policy', () => {
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

  assert.equal(report.passed, true);
  assert.deepEqual(report.issues, []);
  assert.deepEqual(report.metrics.topRowRightSlotLengths, [2, 2, 2]);
  assert.equal(report.metrics.columnDownCoverage, 0.8);
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
