const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const catalog = require('../apps/mobile/data/generated/clue-catalog.json');
const { parseArguments } = require('./generate-daily-puzzle');
const {
  createDailyPuzzlePublication,
  writeImmutablePublication,
} = require('./lib/daily-puzzle-publication');

const publicationRequest = {
  date: '2026-08-23',
  profileId: 'easy-mixed-wide',
  revision: 'v1',
};

test('creates the same quality-approved publication for the same request', () => {
  const firstPublication = createDailyPuzzlePublication(catalog, publicationRequest);
  const secondPublication = createDailyPuzzlePublication(catalog, publicationRequest);

  assert.deepEqual(firstPublication, secondPublication);
  assert.equal(firstPublication.schemaVersion, 1);
  assert.equal(firstPublication.puzzle.id, 'gunun-2026-08-23');
  assert.equal(firstPublication.quality.passed, true);
  assert.equal(firstPublication.puzzle.cells.some(({ type }) => type === 'void'), false);
});

test('keeps published daily puzzle files immutable', async () => {
  const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), 'cengel-daily-'));
  const outputPath = path.join(temporaryDirectory, 'gunun-2026-08-23.json');
  const publication = createDailyPuzzlePublication(catalog, publicationRequest);

  try {
    assert.deepEqual(await writeImmutablePublication(outputPath, publication), {
      status: 'written',
    });
    assert.deepEqual(await writeImmutablePublication(outputPath, publication), {
      status: 'unchanged',
    });
    assert.deepEqual(JSON.parse(await readFile(outputPath, 'utf8')), publication);
    await assert.rejects(
      () =>
        writeImmutablePublication(outputPath, {
          ...publication,
          revision: 'v2',
        }),
      /immutable and already exists/,
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test('requires explicit publication arguments', () => {
  assert.deepEqual(
    parseArguments([
      '--date',
      '2026-08-23',
      '--profile',
      'easy-mixed-wide',
      '--revision',
      'v1',
      '--check',
    ]),
    {
      checkOnly: true,
      date: '2026-08-23',
      outputPath: undefined,
      profileId: 'easy-mixed-wide',
      revision: 'v1',
    },
  );
  assert.throws(
    () => parseArguments(['--date', '2026-08-23', '--check']),
    /Missing required option/,
  );
});
