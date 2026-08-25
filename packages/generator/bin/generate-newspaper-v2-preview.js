#!/usr/bin/env node

const { mkdir, readFile, writeFile } = require('node:fs/promises');
const path = require('node:path');

const {
  createNewspaperV2GenerationOptions,
  generateNewspaperPuzzleV2,
} = require('../src/newspaper-v2');
const { validateGeneratedPuzzle } = require('../src/puzzle-manifest');

const CATALOG_PATH = path.resolve(
  process.cwd(),
  'apps/mobile/data/generated/clue-catalog.json',
);
const DEFAULT_OUTPUT_PATH = path.resolve(
  process.cwd(),
  'apps/mobile/data/generated/newspaper-v2-preview.json',
);
const PREVIEW_REQUESTS = Object.freeze([
  {
    id: 'newspaper-v2-preview-7x7',
    title: 'Kompakt Coğrafya ve Türkçe',
    categories: ['cografya', 'yer', 'turkce'],
    categoryWeight: 0.6,
    columnCount: 7,
    difficulty: 'beginner',
    rowCount: 7,
    seed: 'newspaper-v2-preview-7x7-a',
    targetWordCount: 14,
  },
  {
    id: 'newspaper-v2-preview-8x8',
    title: 'Edebiyat, Sanat ve Tarih',
    categories: ['edebiyat', 'sanat', 'tarih'],
    categoryWeight: 0.55,
    columnCount: 8,
    difficulty: 'medium',
    rowCount: 8,
    seed: 'newspaper-v2-preview-8x8-a',
    targetWordCount: 15,
  },
  {
    id: 'newspaper-v2-preview-9x10',
    title: 'Bilim ve Teknoloji',
    categories: ['bilim', 'teknoloji', 'genel_kultur'],
    categoryWeight: 0.6,
    columnCount: 10,
    difficulty: 'easy',
    rowCount: 9,
    seed: 'newspaper-v2-preview-9x10-a',
    targetWordCount: 25,
  },
  {
    id: 'newspaper-v2-preview-10x10',
    title: 'Tarih ve Coğrafya',
    categories: ['tarih', 'cografya', 'genel_kultur', 'turkce'],
    categoryWeight: 0.55,
    columnCount: 10,
    difficulty: 'easy',
    rowCount: 10,
    seed: 'newspaper-v2-preview-10x10-a',
    targetWordCount: 29,
  },
  {
    id: 'newspaper-v2-preview-10x12',
    title: 'Büyük Bilim ve Teknoloji',
    categories: ['bilim', 'teknoloji', 'genel_kultur', 'turkce'],
    categoryWeight: 0.55,
    columnCount: 12,
    difficulty: 'easy',
    rowCount: 10,
    seed: 'newspaper-v2-preview-10x12-a',
    targetWordCount: 39,
  },
]);

function parseArguments(argumentsList) {
  const options = { checkOnly: false, outputPath: DEFAULT_OUTPUT_PATH };

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

  return options;
}

async function createPreviewManifest() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const results = PREVIEW_REQUESTS.map((request) =>
    generateNewspaperPuzzleV2(
      catalog.entries,
      request,
      createNewspaperV2GenerationOptions(request),
    ),
  );

  for (const { puzzle } of results) {
    validateGeneratedPuzzle(puzzle);
  }

  return {
    manifest: {
      schemaVersion: 1,
      sourceCatalog: 'data/generated/clue-catalog.json',
      rights: {
        basis: 'project-owned',
        confirmedAt: '2026-08-19',
      },
      puzzles: results.map(({ puzzle }) => puzzle),
    },
    summaries: results.map(({ diagnostics, puzzle }) => ({
      id: puzzle.id,
      size: `${puzzle.rowCount}x${puzzle.columnCount}`,
      difficulty: puzzle.difficulty,
      categories: puzzle.categories,
      words: puzzle.words.length,
      topologyFingerprint: puzzle.generation.topologyFingerprint,
      aestheticScore: puzzle.generation.aestheticScore,
      clueText: diagnostics.clueText,
      failedFillAttempts: diagnostics.failedFills.length,
    })),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const { manifest, summaries } = await createPreviewManifest();
  const serializedManifest = `${JSON.stringify(manifest)}\n`;

  console.log(JSON.stringify(summaries, null, 2));

  if (options.checkOnly) {
    const currentManifest = await readFile(options.outputPath, 'utf8').catch(() => '');

    if (currentManifest !== serializedManifest) {
      throw new Error(
        'V2 preview manifest is out of date. Run `npm run newspaper:v2:preview:build`.',
      );
    }

    return;
  }

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, serializedManifest, 'utf8');
  console.log(`Wrote ${manifest.puzzles.length} V2 preview puzzles to ${options.outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
