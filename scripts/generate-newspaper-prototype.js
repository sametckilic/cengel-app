#!/usr/bin/env node

const { mkdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const { fillNewspaperTopology } = require('./lib/newspaper-fill');
const { createNewspaperPrototypeTopology } = require('./lib/newspaper-topology');

const CATALOG_PATH = path.resolve(
  process.cwd(),
  'apps/mobile/data/generated/clue-catalog.json',
);
const PROTOTYPE_REQUEST = {
  id: 'newspaper-prototype-8x8',
  title: 'Günün 8×8 Çengel Bulmacası',
  categories: ['turkce', 'genel_kultur'],
  categoryWeight: 0.6,
  columnCount: 8,
  difficulty: 'easy',
  rowCount: 8,
  seed: 'newspaper-prototype-8x8-v2',
  targetWordCount: 17,
};

function parseArguments(argumentsList) {
  const options = { checkOnly: false, outputPath: undefined };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === '--check') {
      options.checkOnly = true;
      continue;
    }

    if (argument === '--output') {
      const outputPath = argumentsList[index + 1];

      if (!outputPath) {
        throw new Error('The --output option requires a file path.');
      }

      options.outputPath = path.resolve(process.cwd(), outputPath);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  if (options.checkOnly === Boolean(options.outputPath)) {
    throw new Error('Use --check or provide --output <path>.');
  }

  return options;
}

function createSolutionPreview(puzzle) {
  const characterByCell = new Map();

  for (const word of puzzle.words) {
    word.cellIndices.forEach((cellIndex, letterIndex) => {
      characterByCell.set(cellIndex, word.answer[letterIndex]);
    });
  }

  return Array.from({ length: puzzle.rowCount }, (_, rowIndex) =>
    puzzle.cells
      .slice(rowIndex * puzzle.columnCount, (rowIndex + 1) * puzzle.columnCount)
      .map((cell, columnIndex) => {
        const cellIndex = rowIndex * puzzle.columnCount + columnIndex;

        if (cell.type === 'split-clue') {
          return '↘';
        }

        if (cell.type === 'clue') {
          return cell.direction === 'right' ? '→' : '↓';
        }

        return characterByCell.get(cellIndex);
      })
      .join(' '),
  ).join('\n');
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const topology = createNewspaperPrototypeTopology();
  const { diagnostics, puzzle } = fillNewspaperTopology(
    catalog.entries,
    PROTOTYPE_REQUEST,
    topology,
  );
  const summary = {
    id: puzzle.id,
    size: `${puzzle.rowCount}x${puzzle.columnCount}`,
    format: puzzle.format,
    cells: diagnostics.validation.cellTypeCounts,
    words: puzzle.words.length,
    directions: diagnostics.validation.directionCounts,
    intersections: diagnostics.validation.intersectionCellCount,
    themedWords: diagnostics.themedWordCount,
    requiredThemedWords: diagnostics.requiredThemedWordCount,
    searchNodes: diagnostics.searchNodeCount,
    backtracks: diagnostics.backtrackCount,
    fallbackWords: diagnostics.fallbackWordCount,
    newspaperReady: diagnostics.validation.newspaperReady,
  };

  console.log(JSON.stringify(summary, null, 2));
  console.log('\nÇözüm önizlemesi (oklar cevap yönünü gösterir):');
  console.log(createSolutionPreview(puzzle));

  if (options.checkOnly) {
    return;
  }

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(puzzle)}\n`, 'utf8');
  console.log(`\nWrote newspaper prototype to ${options.outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
