#!/usr/bin/env node

const {
  evaluateNewspaperTopologyAesthetics,
} = require('../src/newspaper-aesthetics');
const {
  createNewspaper9x10Topology,
  createNewspaperBeginner7x7Topology,
  createNewspaperMedium8x8Topology,
  createNewspaperPrototypeTopology,
} = require('../src/newspaper-topology');

const topologies = [
  createNewspaperPrototypeTopology(),
  createNewspaper9x10Topology(),
  createNewspaperBeginner7x7Topology(),
  createNewspaperMedium8x8Topology(),
];

const reports = topologies.map((topology) => ({
  id: topology.id,
  size: `${topology.rowCount}x${topology.columnCount}`,
  ...evaluateNewspaperTopologyAesthetics(topology),
}));

process.stdout.write(`${JSON.stringify(reports, null, 2)}\n`);
