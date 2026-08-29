import type { GameplayDifficulty } from './clue-catalog';
import type { PuzzleDefinition, PuzzleManifest } from './puzzle';

const DIFFICULTIES: readonly GameplayDifficulty[] = [
  'beginner',
  'easy',
  'medium',
  'hard',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isPuzzleDefinition(value: unknown): value is PuzzleDefinition {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Array.isArray(value.categories) &&
    value.categories.every((category) => typeof category === 'string') &&
    typeof value.difficulty === 'string' &&
    DIFFICULTIES.includes(value.difficulty as GameplayDifficulty) &&
    Number.isInteger(value.rowCount) &&
    Number.isInteger(value.columnCount) &&
    Array.isArray(value.cells) &&
    value.cells.length === Number(value.rowCount) * Number(value.columnCount) &&
    Array.isArray(value.words) &&
    value.words.length > 0 &&
    isRecord(value.initialSelection) &&
    typeof value.initialSelection.wordId === 'string' &&
    Number.isInteger(value.initialSelection.cellIndex)
  );
}

export function isPuzzleManifest(value: unknown): value is PuzzleManifest {
  return (
    isRecord(value) &&
    value.schemaVersion === 1 &&
    typeof value.sourceCatalog === 'string' &&
    isRecord(value.rights) &&
    value.rights.basis === 'project-owned' &&
    value.rights.confirmedAt === '2026-08-19' &&
    Array.isArray(value.puzzles) &&
    value.puzzles.every(isPuzzleDefinition) &&
    new Set(value.puzzles.map((puzzle) => puzzle.id)).size === value.puzzles.length
  );
}
