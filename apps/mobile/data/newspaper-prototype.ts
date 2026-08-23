import generatedPrototype from '@/data/generated/newspaper-prototype-8x8.json';
import type { NewspaperPuzzleDefinition } from '@cengel/puzzle-core/puzzle';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNewspaperPuzzleDefinition(value: unknown): value is NewspaperPuzzleDefinition {
  if (!isRecord(value)) {
    return false;
  }

  const expectedCellCount = Number(value.rowCount) * Number(value.columnCount);

  return (
    value.format === 'newspaper-arrowword' &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    Number.isInteger(value.rowCount) &&
    Number.isInteger(value.columnCount) &&
    Array.isArray(value.categories) &&
    Array.isArray(value.cells) &&
    value.cells.length === expectedCellCount &&
    value.cells.every(
      (cell) =>
        isRecord(cell) &&
        (cell.type === 'letter' || cell.type === 'clue' || cell.type === 'split-clue'),
    ) &&
    Array.isArray(value.words) &&
    value.words.length > 0
  );
}

const prototype: unknown = generatedPrototype;

if (!isNewspaperPuzzleDefinition(prototype)) {
  throw new Error(
    'Generated newspaper prototype is invalid. Run `npm run newspaper:prototype:build`.',
  );
}

export const NEWSPAPER_PROTOTYPE = prototype;
