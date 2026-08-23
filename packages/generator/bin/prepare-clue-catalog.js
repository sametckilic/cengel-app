#!/usr/bin/env node

const { createReadStream } = require('node:fs');
const { mkdir, writeFile } = require('node:fs/promises');
const path = require('node:path');
const readline = require('node:readline');

const SOURCE_FILE = 'datasets/crossword_clues_gameplay_ready.jsonl';
const SOURCE_PATH = path.resolve(process.cwd(), SOURCE_FILE);
const ANSWER_PATTERN = /^[A-ZÇĞİÖŞÜ]+$/;
const ALLOWED_SCREEN_FITS = new Set(['acceptable', 'ideal']);
const DISALLOWED_FLAGS = new Set([
  'ambiguous_clue',
  'answer_leaked',
  'sensitive_content',
  'temporal_fact',
  'typo_suspected',
]);
const FILTERS = Object.freeze({
  ambiguityScoreMax: 20,
  answerLengthMax: 8,
  answerLengthMin: 2,
  clarityScoreMin: 90,
  clueQualityMin: 85,
  factualityScoreMin: 95,
  gameplayScoreMin: 90,
});

function parseArguments(argumentsList) {
  const options = {
    checkOnly: false,
    outputPath: undefined,
  };

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

  if (options.checkOnly && options.outputPath) {
    throw new Error('Use either --check or --output, not both.');
  }

  if (!options.checkOnly && !options.outputPath) {
    throw new Error('Use --check or provide --output <path>.');
  }

  return options;
}

function validateRecord(record, lineNumber) {
  const errors = [];
  const requiredStrings = [
    'answer_normalized',
    'clue',
    'gameplay_difficulty',
    'gameplay_status',
    'id',
    'license',
    'short_clue',
    'source',
  ];
  const requiredNumbers = [
    'ambiguity_score',
    'answer_length',
    'clarity_score',
    'clue_quality',
    'commercial_use_allowed',
    'factuality_score',
    'gameplay_score',
  ];

  for (const field of requiredStrings) {
    if (typeof record[field] !== 'string') {
      errors.push(`${field} must be a string`);
    }
  }

  for (const field of requiredNumbers) {
    if (typeof record[field] !== 'number' || !Number.isFinite(record[field])) {
      errors.push(`${field} must be a finite number`);
    }
  }

  if (!Array.isArray(record.flags) || !record.flags.every((flag) => typeof flag === 'string')) {
    errors.push('flags must be an array of strings');
  }

  if (
    typeof record.answer_normalized === 'string' &&
    !ANSWER_PATTERN.test(record.answer_normalized)
  ) {
    errors.push('answer_normalized contains unsupported characters');
  }

  if (
    typeof record.answer_normalized === 'string' &&
    typeof record.answer_length === 'number' &&
    record.answer_normalized.length !== record.answer_length
  ) {
    errors.push('answer_length does not match answer_normalized');
  }

  return errors.map((error) => `Line ${lineNumber}: ${error}`);
}

function isQualityCandidate(record) {
  const hasSupportedGridFit =
    record.grid_fit === 'ideal' ||
    (record.answer_length === 2 && record.grid_fit === 'acceptable');

  return (
    record.gameplay_status === 'ready' &&
    record.answer_length >= FILTERS.answerLengthMin &&
    record.answer_length <= FILTERS.answerLengthMax &&
    record.gameplay_score >= FILTERS.gameplayScoreMin &&
    record.clue_quality >= FILTERS.clueQualityMin &&
    record.clarity_score >= FILTERS.clarityScoreMin &&
    record.ambiguity_score <= FILTERS.ambiguityScoreMax &&
    record.factuality_score >= FILTERS.factualityScoreMin &&
    ALLOWED_SCREEN_FITS.has(record.screen_fit) &&
    hasSupportedGridFit &&
    !record.flags.some((flag) => DISALLOWED_FLAGS.has(flag))
  );
}

function compareRecordQuality(left, right) {
  return (
    right.gameplay_score - left.gameplay_score ||
    right.clue_quality - left.clue_quality ||
    right.clarity_score - left.clarity_score ||
    left.ambiguity_score - right.ambiguity_score ||
    left.id.localeCompare(right.id, 'tr')
  );
}

function deduplicateByAnswer(records) {
  const bestByAnswer = new Map();

  for (const record of records) {
    const current = bestByAnswer.get(record.answer_normalized);

    if (!current || compareRecordQuality(record, current) < 0) {
      bestByAnswer.set(record.answer_normalized, record);
    }
  }

  return [...bestByAnswer.values()].sort(
    (left, right) =>
      left.answer_length - right.answer_length ||
      left.answer_normalized.localeCompare(right.answer_normalized, 'tr'),
  );
}

function toCatalogEntry(record) {
  return {
    id: record.id,
    answer: record.answer_normalized,
    answerLength: record.answer_length,
    clue: record.clue.trim(),
    shortClue: record.short_clue.trim() || record.clue.trim(),
    difficulty: record.gameplay_difficulty,
    fallbackOnly: record.answer_length === 2,
    category: record.answer_category || 'diger',
    kind: record.answer_kind || 'bilinmiyor',
  };
}

async function readDataset() {
  const records = [];
  const validationErrors = [];
  const input = createReadStream(SOURCE_PATH, { encoding: 'utf8' });
  const lines = readline.createInterface({ crlfDelay: Infinity, input });
  let lineNumber = 0;

  for await (const line of lines) {
    lineNumber += 1;

    if (!line.trim()) {
      continue;
    }

    try {
      const record = JSON.parse(line);
      validationErrors.push(...validateRecord(record, lineNumber));
      records.push(record);
    } catch (error) {
      validationErrors.push(`Line ${lineNumber}: invalid JSON (${error.message})`);
    }
  }

  return { records, validationErrors };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const { records, validationErrors } = await readDataset();

  if (validationErrors.length > 0) {
    const preview = validationErrors.slice(0, 20).join('\n');
    throw new Error(
      `Dataset validation failed with ${validationErrors.length} error(s):\n${preview}`,
    );
  }

  const qualityCandidates = records.filter(isQualityCandidate);
  const qualityEntries = deduplicateByAnswer(qualityCandidates);
  const report = {
    totalRecords: records.length,
    qualityCandidates: qualityCandidates.length,
    qualityEntriesAfterDeduplication: qualityEntries.length,
    legacyCommercialUseAllowedRows: records.filter(
      (record) => record.commercial_use_allowed === 1,
    ).length,
  };

  console.log(JSON.stringify(report, null, 2));

  if (options.checkOnly) {
    return;
  }

  if (qualityEntries.length === 0) {
    throw new Error('No entries passed the catalog quality filters.');
  }

  const catalog = {
    schemaVersion: 1,
    sourceFile: SOURCE_FILE,
    usage: 'project-owned',
    rights: {
      basis: 'project-owned',
      confirmedAt: '2026-08-19',
    },
    filters: FILTERS,
    entries: qualityEntries.map(toCatalogEntry),
  };

  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await writeFile(options.outputPath, `${JSON.stringify(catalog)}\n`, 'utf8');
  console.log(`Wrote ${catalog.entries.length} entries to ${options.outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
