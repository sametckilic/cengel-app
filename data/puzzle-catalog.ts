import generatedManifest from '@/data/generated/puzzles.json';
import { NEWSPAPER_PROTOTYPE } from '@/data/newspaper-prototype';
import type { GameplayDifficulty } from '@/types/clue-catalog';
import type {
  NewspaperPuzzleDefinition,
  PuzzleDefinition,
  PuzzleManifest,
} from '@/types/puzzle';

const DIFFICULTIES: readonly GameplayDifficulty[] = ['beginner', 'easy', 'medium', 'hard'];
const DIFFICULTY_LABELS: Record<GameplayDifficulty, string> = {
  beginner: 'Başlangıç',
  easy: 'Kolay',
  medium: 'Orta',
  hard: 'Zor',
};
const CATEGORY_LABELS: Record<string, string> = {
  bilim: 'Bilim',
  bitki: 'Bitki',
  cografya: 'Coğrafya',
  diger: 'Diğer',
  edebiyat: 'Edebiyat',
  genel_kultur: 'Genel Kültür',
  hayvan: 'Hayvanlar',
  kisi: 'Kişiler',
  kurum: 'Kurumlar',
  mitoloji: 'Mitoloji',
  muzik: 'Müzik',
  sanat: 'Sanat',
  sinema: 'Sinema',
  spor: 'Spor',
  tarih: 'Tarih',
  teknoloji: 'Teknoloji',
  tip: 'Tıp',
  turkce: 'Türkçe',
  yemek: 'Yemek',
  yer: 'Yerler',
};

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
    value.puzzles.length > 0 &&
    value.puzzles.every(isPuzzleDefinition) &&
    new Set(value.puzzles.map((puzzle) => puzzle.id)).size === value.puzzles.length
  );
}

const manifest: unknown = generatedManifest;

if (!isPuzzleManifest(manifest)) {
  throw new Error('Generated puzzle manifest is invalid. Run `npm run puzzles:build`.');
}

if (manifest.puzzles.some(({ id }) => id === NEWSPAPER_PROTOTYPE.id)) {
  throw new Error(`Duplicate puzzle id in shared catalog: "${NEWSPAPER_PROTOTYPE.id}".`);
}

export const BUNDLED_PUZZLE_MANIFEST: PuzzleManifest = manifest;

export function createPuzzleCatalog(
  puzzleManifest: PuzzleManifest,
): readonly PuzzleDefinition[] {
  if (puzzleManifest.puzzles.some(({ id }) => id === NEWSPAPER_PROTOTYPE.id)) {
    throw new Error(`Duplicate puzzle id in shared catalog: "${NEWSPAPER_PROTOTYPE.id}".`);
  }

  return [NEWSPAPER_PROTOTYPE, ...puzzleManifest.puzzles];
}

export function mergePuzzleManifests(
  baseManifest: PuzzleManifest,
  incomingManifest: PuzzleManifest,
): PuzzleManifest {
  const puzzlesById = new Map(
    [...baseManifest.puzzles, ...incomingManifest.puzzles].map((puzzle) => [
      puzzle.id,
      puzzle,
    ]),
  );

  return {
    ...baseManifest,
    puzzles: [...puzzlesById.values()],
  };
}

export const PUZZLE_CATALOG: readonly PuzzleDefinition[] = createPuzzleCatalog(
  BUNDLED_PUZZLE_MANIFEST,
);
export const DEFAULT_PUZZLE_ID = NEWSPAPER_PROTOTYPE.id;

export function getPuzzleById(id: string): PuzzleDefinition | undefined {
  return PUZZLE_CATALOG.find((puzzle) => puzzle.id === id);
}

export function getLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function findDailyPuzzle(
  puzzles: readonly PuzzleDefinition[],
  date: Date,
): PuzzleDefinition | undefined {
  return puzzles.find(({ id }) => id === `gunun-${getLocalDateKey(date)}`);
}

export function findLatestDailyPuzzle(
  puzzles: readonly PuzzleDefinition[],
): PuzzleDefinition | undefined {
  return [...puzzles]
    .filter(({ id }) => /^gunun-\d{4}-\d{2}-\d{2}$/.test(id))
    .sort((left, right) => right.id.localeCompare(left.id))[0];
}

export function getDailyPuzzleForDate(date: Date): PuzzleDefinition | undefined {
  return findDailyPuzzle(PUZZLE_CATALOG, date);
}

export function getLatestDailyPuzzle(): PuzzleDefinition | undefined {
  return findLatestDailyPuzzle(PUZZLE_CATALOG);
}

export function isNewspaperPuzzleDefinition(
  puzzle: PuzzleDefinition,
): puzzle is NewspaperPuzzleDefinition {
  return 'format' in puzzle && puzzle.format === 'newspaper-arrowword';
}

export function getPuzzleHref(id: string) {
  return {
    pathname: '/puzzle/[id]' as const,
    params: { id },
  };
}

export function getThemedPuzzles(category: string): readonly PuzzleDefinition[] {
  return PUZZLE_CATALOG.filter(
    (puzzle) => puzzle.categories.length === 1 && puzzle.categories[0] === category,
  );
}

export function getDifficultyLabel(difficulty: GameplayDifficulty): string {
  return DIFFICULTY_LABELS[difficulty];
}

export function getCategoryLabel(category: string): string {
  return (
    CATEGORY_LABELS[category] ??
    category
      .split('_')
      .map((part) => part.charAt(0).toLocaleUpperCase('tr-TR') + part.slice(1))
      .join(' ')
  );
}

export function getPuzzleSizeLabel(puzzle: PuzzleDefinition): string {
  return `${puzzle.rowCount}×${puzzle.columnCount}`;
}

export function getPuzzleCategoryLabel(puzzle: PuzzleDefinition): string {
  return puzzle.categories.map(getCategoryLabel).join(', ');
}
