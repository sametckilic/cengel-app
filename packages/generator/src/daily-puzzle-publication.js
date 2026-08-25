const { mkdir, readFile, rename, unlink, writeFile } = require('node:fs/promises');
const path = require('node:path');

const { buildDailyPuzzleCandidate } = require('./daily-puzzle-quality');
const { createDailyPuzzleRecipe } = require('./daily-puzzle-recipe');
const { getDailyPuzzleProfile } = require('./daily-puzzle-profiles');

const SOURCE_CATALOG = 'data/generated/clue-catalog.json';

function createDailyPuzzlePublication(catalog, { date, profileId, revision }) {
  const profile = getDailyPuzzleProfile(profileId);
  const recipe = createDailyPuzzleRecipe({ date, profile, revision });
  const { diagnostics, puzzle, quality } = buildDailyPuzzleCandidate(
    catalog.entries,
    recipe,
  );

  const v2Diagnostics =
    puzzle.generation.generatorVersion === 'newspaper-v2'
      ? {
          aesthetic: diagnostics.aesthetic,
          clueText: diagnostics.clueText,
          failedFillCount: diagnostics.failedFills.length,
          topologyFingerprint: puzzle.generation.topologyFingerprint,
        }
      : {};

  return {
    schemaVersion: 1,
    date,
    profileId,
    revision,
    sourceCatalog: SOURCE_CATALOG,
    rights: catalog.rights,
    recipe,
    quality,
    generationDiagnostics: {
      backtrackCount: diagnostics.backtrackCount,
      searchNodeCount: diagnostics.searchNodeCount,
      ...v2Diagnostics,
    },
    puzzle,
  };
}

async function readExistingPublication(outputPath) {
  try {
    return await readFile(outputPath, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

async function getImmutablePublicationStatus(outputPath, publication) {
  const content = `${JSON.stringify(publication)}\n`;
  const existingContent = await readExistingPublication(outputPath);

  if (existingContent === null) {
    return 'missing';
  }

  if (existingContent === content) {
    return 'unchanged';
  }

  throw new Error(`Published daily puzzle is immutable and already exists: ${outputPath}`);
}

async function writeImmutablePublication(outputPath, publication) {
  const content = `${JSON.stringify(publication)}\n`;
  const status = await getImmutablePublicationStatus(outputPath, publication);

  if (status === 'unchanged') {
    return { status };
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;

  try {
    await writeFile(temporaryPath, content, { encoding: 'utf8', flag: 'wx' });
    await rename(temporaryPath, outputPath);
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }

  return { status: 'written' };
}

module.exports = {
  createDailyPuzzlePublication,
  getImmutablePublicationStatus,
  writeImmutablePublication,
};
