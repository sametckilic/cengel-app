#!/usr/bin/env node

const { readFile, mkdir, readdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const { buildPuzzleManifest } = require('./lib/puzzle-manifest');
const {
  filterPublicationsAvailableOn,
  getDateKeyInTimeZone,
} = require('./lib/daily-puzzle-schedule');

const CATALOG_PATH = path.resolve(process.cwd(), 'data/generated/clue-catalog.json');
const RECIPES_PATH = path.resolve(process.cwd(), 'data/puzzle-recipes.json');
const DAILY_PUBLICATIONS_DIRECTORY = path.resolve(
  process.cwd(),
  'data/generated/daily',
);

function parseArguments(argumentsList) {
  const options = {
    checkOnly: false,
    asOfDate: getDateKeyInTimeZone(),
    outputPath: undefined,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === '--check') {
      options.checkOnly = true;
      continue;
    }

    if (argument === '--as-of') {
      const asOfDate = argumentsList[index + 1];

      if (!asOfDate) {
        throw new Error('The --as-of option requires a date.');
      }

      options.asOfDate = asOfDate;
      index += 1;
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

  if (options.checkOnly && options.outputPath) {
    throw new Error('Use either --check or --output, not both.');
  }

  if (!options.checkOnly && !options.outputPath) {
    throw new Error('Use --check or provide --output <path>.');
  }

  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readDailyPublications() {
  let filenames;

  try {
    filenames = await readdir(DAILY_PUBLICATIONS_DIRECTORY);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return [];
    }

    throw error;
  }

  return Promise.all(
    filenames
      .filter((filename) => filename.endsWith('.json'))
      .sort()
      .map((filename) => readJson(path.join(DAILY_PUBLICATIONS_DIRECTORY, filename))),
  );
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const [catalog, recipes, dailyPublications] = await Promise.all([
    readJson(CATALOG_PATH),
    readJson(RECIPES_PATH),
    readDailyPublications(),
  ]);
  const availableDailyPublications = filterPublicationsAvailableOn(
    dailyPublications,
    options.asOfDate,
  );
  const manifest = buildPuzzleManifest(catalog, recipes, availableDailyPublications);
  const summary = manifest.puzzles.map((puzzle) => ({
    id: puzzle.id,
    format: puzzle.format ?? 'freeform-arrowword',
    size: `${puzzle.rowCount}x${puzzle.columnCount}`,
    difficulty: puzzle.difficulty,
    categories: puzzle.categories,
    themedWords: puzzle.words.filter(({ category }) =>
      puzzle.categories.includes(category),
    ).length,
    categoryWeight: puzzle.generation.categoryWeight,
    words: puzzle.words.length,
    intersections: puzzle.generation.intersectionCount,
    voidCells: puzzle.cells.filter(({ type }) => type === 'void').length,
  }));

  console.log(JSON.stringify(summary, null, 2));

  if (options.checkOnly) {
    return;
  }

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(manifest)}\n`, 'utf8');
  console.log(`Wrote ${manifest.puzzles.length} puzzles to ${options.outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
