#!/usr/bin/env node

const { readFile } = require('node:fs/promises');
const path = require('node:path');

const {
  CONTENT_PUBLICATION_PLAN,
  createScheduledContentPublication,
} = require('../src/content-publication-schedule');

const CATALOG_PATH = path.resolve(
  process.cwd(),
  'apps/mobile/data/generated/clue-catalog.json',
);

async function main() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const summaries = [];

  for (const [index, item] of CONTENT_PUBLICATION_PLAN.entries()) {
    const startedAt = Date.now();
    console.error(
      `[${index + 1}/${CONTENT_PUBLICATION_PLAN.length}] Checking ${item.puzzleId}...`,
    );
    const publication = createScheduledContentPublication(catalog, item);
    const { puzzle, quality } = publication;
    const themedWordCount = puzzle.words.filter(({ category }) =>
      puzzle.categories.includes(category),
    ).length;
    const requiredThemedWordCount = Math.ceil(
      puzzle.words.length * puzzle.generation.categoryWeight,
    );

    if (
      publication.date !== item.publicationDate ||
      puzzle.id !== item.puzzleId ||
      puzzle.title !== item.title ||
      puzzle.format !== 'newspaper-arrowword' ||
      puzzle.generation.generatorVersion !== 'newspaper-v2' ||
      puzzle.rowCount !== item.profile.rowCount ||
      puzzle.columnCount !== item.profile.columnCount ||
      puzzle.difficulty !== item.profile.difficulty ||
      puzzle.words.length !== item.profile.targetWordCount ||
      quality.passed !== true ||
      quality.issues.length > 0 ||
      themedWordCount < requiredThemedWordCount ||
      themedWordCount <= puzzle.words.length / 2 ||
      puzzle.cells.some(({ type }) => type === 'void' || type === 'block')
    ) {
      throw new Error(`Content plan item "${item.puzzleId}" failed its contract.`);
    }

    summaries.push({
      channel: item.channel,
      difficulty: puzzle.difficulty,
      generationAttempt: Number(publication.revision.match(/-a(\d+)$/)?.[1]),
      milliseconds: Date.now() - startedAt,
      puzzleId: puzzle.id,
      size: `${puzzle.rowCount}x${puzzle.columnCount}`,
      themedWords: `${themedWordCount}/${requiredThemedWordCount}`,
      words: puzzle.words.length,
    });
  }

  console.log(JSON.stringify(summaries, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
