#!/usr/bin/env node

const { readFile } = require('node:fs/promises');
const path = require('node:path');

const {
  createDailyPuzzlePublication,
  writeImmutablePublication,
} = require('./lib/daily-puzzle-publication');

const CATALOG_PATH = path.resolve(process.cwd(), 'data/generated/clue-catalog.json');

function parseArguments(argumentsList) {
  const options = {
    checkOnly: false,
    date: undefined,
    outputPath: undefined,
    profileId: undefined,
    revision: undefined,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === '--check') {
      options.checkOnly = true;
      continue;
    }

    const optionNames = {
      '--date': 'date',
      '--output': 'outputPath',
      '--profile': 'profileId',
      '--revision': 'revision',
    };
    const optionName = optionNames[argument];

    if (optionName) {
      const value = argumentsList[index + 1];

      if (!value) {
        throw new Error(`The ${argument} option requires a value.`);
      }

      options[optionName] =
        optionName === 'outputPath' ? path.resolve(process.cwd(), value) : value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  for (const requiredOption of ['date', 'profileId', 'revision']) {
    if (!options[requiredOption]) {
      throw new Error(`Missing required option: ${requiredOption}`);
    }
  }

  if (options.checkOnly === Boolean(options.outputPath)) {
    throw new Error('Use either --check or --output <path>.');
  }

  return options;
}

function summarizePublication(publication) {
  return {
    id: publication.puzzle.id,
    profileId: publication.profileId,
    size: `${publication.puzzle.rowCount}x${publication.puzzle.columnCount}`,
    difficulty: publication.puzzle.difficulty,
    categories: publication.puzzle.categories,
    wordCount: publication.quality.metrics.wordCount,
    intersectionCount: publication.quality.metrics.intersectionCount,
    qualityPassed: publication.quality.passed,
  };
}

async function main(argumentsList = process.argv.slice(2)) {
  const options = parseArguments(argumentsList);
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const publication = createDailyPuzzlePublication(catalog, options);

  console.log(JSON.stringify(summarizePublication(publication), null, 2));

  if (options.checkOnly) {
    return { publication, status: 'checked' };
  }

  const result = await writeImmutablePublication(options.outputPath, publication);
  console.log(`${result.status === 'written' ? 'Wrote' : 'Kept'} ${options.outputPath}`);
  return { publication, status: result.status };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  main,
  parseArguments,
  summarizePublication,
};
