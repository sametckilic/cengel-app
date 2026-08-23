import type { PuzzleDefinition } from '@cengel/puzzle-core/puzzle';

export const DAILY_PUZZLE = {
  id: 'daily-2023-10-24',
  title: 'Günün Bulmacası',
  categories: ['genel_kultur'],
  columnCount: 8,
  difficulty: 'easy',
  rowCount: 8,
  initialSelection: {
    cellIndex: 3,
    wordId: 'ankara',
  },
  words: [
    {
      id: 'ankara',
      answer: 'ANKARA',
      category: 'cografya',
      clue: "Anadolu'da bir ilimiz",
      direction: 'right',
      cellIndices: [1, 2, 3, 4, 5, 6],
    },
  ],
  cells: [
    {
      type: 'split-clue',
      clues: [
        { label: 'İl', direction: 'right' },
        { label: 'Canlı', direction: 'down' },
      ],
    },
    { type: 'letter', initialValue: 'A' },
    { type: 'letter', initialValue: 'N' },
    { type: 'letter', initialValue: 'K' },
    { type: 'letter', initialValue: 'A' },
    { type: 'letter', initialValue: 'R' },
    { type: 'letter', initialValue: 'A' },
    { type: 'void' },

    { type: 'clue', label: 'Suda yaşayan bir canlı', direction: 'down' },
    { type: 'void' },
    { type: 'clue', label: 'Renk', direction: 'down' },
    { type: 'letter', initialValue: 'E' },
    { type: 'clue', label: 'Yön', direction: 'down' },
    { type: 'void' },
    { type: 'clue', label: 'Nota', direction: 'down' },
    { type: 'void' },

    { type: 'letter', initialValue: 'B' },
    { type: 'letter', initialValue: 'A' },
    { type: 'letter', initialValue: 'L' },
    { type: 'letter', initialValue: 'I' },
    { type: 'letter', initialValue: 'K' },
    { type: 'void' },
    { type: 'letter', initialValue: 'D' },
    { type: 'letter', initialValue: 'O' },

    { type: 'letter', initialValue: 'A' },
    { type: 'void' },
    { type: 'letter', initialValue: 'A' },
    { type: 'clue', label: 'Genişlik', direction: 'right' },
    { type: 'letter', initialValue: 'E' },
    { type: 'letter', initialValue: 'N' },
    { type: 'void' },
    { type: 'void' },

    { type: 'clue', label: 'Bir meyve', direction: 'right' },
    { type: 'letter', initialValue: 'E' },
    { type: 'letter', initialValue: 'L' },
    { type: 'letter', initialValue: 'M' },
    { type: 'letter', initialValue: 'A' },
    { type: 'void' },
    { type: 'letter' },
    { type: 'letter' },

    { type: 'letter' },
    { type: 'void' },
    { type: 'letter' },
    { type: 'letter' },
    { type: 'letter' },
    { type: 'clue', label: 'İsim', direction: 'down' },
    { type: 'letter' },
    { type: 'letter' },

    { type: 'clue', label: 'Ters, zıt', direction: 'right' },
    { type: 'letter' },
    { type: 'letter' },
    { type: 'letter' },
    { type: 'void' },
    { type: 'letter', initialValue: 'A' },
    { type: 'letter', initialValue: 'D' },
    { type: 'void' },

    { type: 'letter' },
    { type: 'letter' },
    { type: 'void' },
    { type: 'letter' },
    { type: 'letter' },
    { type: 'letter' },
    { type: 'letter' },
    { type: 'letter' },
  ],
} as const satisfies PuzzleDefinition;

export const PUZZLES: readonly PuzzleDefinition[] = [DAILY_PUZZLE];

export function getPuzzleById(id: string): PuzzleDefinition | undefined {
  return PUZZLES.find((puzzle) => puzzle.id === id);
}
