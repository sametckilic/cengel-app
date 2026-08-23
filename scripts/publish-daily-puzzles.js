#!/usr/bin/env node

const { readFile, readdir, mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');

const {
  getImmutablePublicationStatus,
  writeImmutablePublication,
} = require('./lib/daily-puzzle-publication');
const {
  addDaysToIsoDate,
  createScheduledDailyPublication,
  filterPublicationsAvailableOn,
  getDateKeyInTimeZone,
  resolveScheduleDate,
} = require('./lib/daily-puzzle-schedule');
const { buildPuzzleManifest } = require('./lib/puzzle-manifest');

const CATALOG_PATH = path.resolve(
  process.cwd(),
  'apps/mobile/data/generated/clue-catalog.json',
);
const RECIPES_PATH = path.resolve(process.cwd(), 'apps/mobile/data/puzzle-recipes.json');
const DEFAULT_OUTPUT_DIRECTORY = path.resolve(
  process.cwd(),
  'apps/mobile/data/generated/daily',
);
const DEFAULT_MANIFEST_PATH = path.resolve(
  process.cwd(),
  'apps/mobile/data/generated/puzzles.json',
);

function parseArguments(argumentsList) {
  const options = {
    asOfDate: getDateKeyInTimeZone(),
    checkOnly: false,
    dayCount: undefined,
    manifestPath: DEFAULT_MANIFEST_PATH,
    outputDirectory: DEFAULT_OUTPUT_DIRECTORY,
    publish: false,
    revision: undefined,
    startDate: undefined,
  };

  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];

    if (argument === '--check') {
      options.checkOnly = true;
      continue;
    }

    if (argument === '--publish') {
      options.publish = true;
      continue;
    }

    const optionNames = {
      '--as-of': 'asOfDate',
      '--days': 'dayCount',
      '--manifest-output': 'manifestPath',
      '--output-dir': 'outputDirectory',
      '--revision': 'revision',
      '--start': 'startDate',
    };
    const optionName = optionNames[argument];

    if (optionName) {
      const value = argumentsList[index + 1];

      if (!value) {
        throw new Error(`The ${argument} option requires a value.`);
      }

      if (optionName === 'dayCount') {
        options.dayCount = Number(value);
      } else if (optionName === 'manifestPath' || optionName === 'outputDirectory') {
        options[optionName] = path.resolve(process.cwd(), value);
      } else {
        options[optionName] = value;
      }

      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${argument}`);
  }

  for (const requiredOption of ['dayCount', 'revision', 'startDate']) {
    if (!options[requiredOption]) {
      throw new Error(`Missing required option: ${requiredOption}`);
    }
  }

  if (options.checkOnly === options.publish) {
    throw new Error('Use either --check or --publish.');
  }

  options.startDate = resolveScheduleDate(options.startDate, options.asOfDate);
  return options;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function readPublications(directory) {
  let filenames;

  try {
    filenames = await readdir(directory);
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
      .map((filename) => readJson(path.join(directory, filename))),
  );
}

function mergePublications(existingPublications, scheduledPublications) {
  return [
    ...new Map(
      [...existingPublications, ...scheduledPublications].map((publication) => [
        publication.date,
        publication,
      ]),
    ).values(),
  ];
}

function createPublicationBatch(
  catalog,
  { dayCount, revision, startDate },
  existingPublications,
) {
  const existingByDate = new Map(
    existingPublications.map((publication) => [publication.date, publication]),
  );

  return Array.from({ length: dayCount }, (_, dayOffset) => {
    const date = addDaysToIsoDate(startDate, dayOffset);

    return (
      existingByDate.get(date) ??
      createScheduledDailyPublication(catalog, { date, revision })
    );
  });
}

function summarizeSchedule(publications, asOfDate) {
  return publications.map((publication) => ({
    date: publication.date,
    id: publication.puzzle.id,
    profileId: publication.profileId,
    revision: publication.revision,
    size: `${publication.puzzle.rowCount}x${publication.puzzle.columnCount}`,
    difficulty: publication.puzzle.difficulty,
    words: publication.puzzle.words.length,
    available: publication.date <= asOfDate,
    qualityPassed: publication.quality.passed,
  }));
}

async function main(argumentsList = process.argv.slice(2)) {
  const options = parseArguments(argumentsList);
  const [catalog, recipes, existingPublications] = await Promise.all([
    readJson(CATALOG_PATH),
    readJson(RECIPES_PATH),
    readPublications(options.outputDirectory),
  ]);
  const scheduledPublications = createPublicationBatch(catalog, {
    dayCount: options.dayCount,
    revision: options.revision,
    startDate: options.startDate,
  }, existingPublications);

  for (const publication of scheduledPublications) {
    const outputPath = path.join(
      options.outputDirectory,
      `${publication.puzzle.id}.json`,
    );
    await getImmutablePublicationStatus(outputPath, publication);
  }

  const allPublications = mergePublications(
    existingPublications,
    scheduledPublications,
  );
  const availablePublications = filterPublicationsAvailableOn(
    allPublications,
    options.asOfDate,
  );
  const manifest = buildPuzzleManifest(catalog, recipes, availablePublications);

  console.log(JSON.stringify(summarizeSchedule(scheduledPublications, options.asOfDate), null, 2));

  if (options.checkOnly) {
    return { manifest, publications: scheduledPublications, status: 'checked' };
  }

  await mkdir(options.outputDirectory, { recursive: true });

  for (const publication of scheduledPublications) {
    await writeImmutablePublication(
      path.join(options.outputDirectory, `${publication.puzzle.id}.json`),
      publication,
    );
  }

  await mkdir(path.dirname(options.manifestPath), { recursive: true });
  await writeFile(options.manifestPath, `${JSON.stringify(manifest)}\n`, 'utf8');
  console.log(
    `Published ${scheduledPublications.length} daily puzzle(s); ` +
      `${availablePublications.length} daily publication(s) are currently visible.`,
  );
  return { manifest, publications: scheduledPublications, status: 'published' };
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  createPublicationBatch,
  main,
  mergePublications,
  parseArguments,
  summarizeSchedule,
};
