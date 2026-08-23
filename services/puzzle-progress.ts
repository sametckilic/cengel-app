export const PUZZLE_PROGRESS_SCHEMA_VERSION = 1 as const;

export type PuzzleProgressSnapshot = {
  entries: Record<number, string>;
  puzzleId: string;
  revealedWordIds: readonly string[];
  schemaVersion: typeof PUZZLE_PROGRESS_SCHEMA_VERSION;
  selection: {
    cellIndex: number;
    wordId: string;
  };
  solvedWordIds: readonly string[];
  updatedAt: string;
};

export type PuzzleProgressStore = {
  list(): Promise<readonly PuzzleProgressSnapshot[]>;
  load(puzzleId: string): Promise<PuzzleProgressSnapshot | null>;
  remove(puzzleId: string): Promise<void>;
  save(progress: PuzzleProgressSnapshot): Promise<void>;
};

export type PuzzleProgressState = {
  entries: Record<number, string | undefined>;
  revealedWordIds: ReadonlySet<string>;
  selection: {
    cellIndex: number;
    wordId: string;
  };
  solvedWordIds: ReadonlySet<string>;
};

export type RestoredPuzzleProgress = {
  entries: Record<number, string>;
  revealedWordIds: ReadonlySet<string>;
  selection: {
    cellIndex: number;
    wordId: string;
  };
  solvedWordIds: ReadonlySet<string>;
};

export type PuzzleProgressSummary = {
  completionPercentage: number;
  revealedWordCount: number;
  solvedWordCount: number;
  status: 'completed' | 'in-progress' | 'not-started';
  totalWordCount: number;
};

type ProgressPuzzle = {
  cells: readonly { type: string }[];
  id: string;
  words: readonly {
    answer: string;
    cellIndices: readonly number[];
    id: string;
  }[];
};

type ProgressSummaryPuzzle = Pick<ProgressPuzzle, 'id' | 'words'>;

const TURKISH_LETTER_PATTERN = /^[A-ZÇĞİÖŞÜ]$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasValidWordIds(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((wordId) => typeof wordId === 'string' && wordId.length > 0) &&
    new Set(value).size === value.length
  );
}

export function isPuzzleProgressSnapshot(value: unknown): value is PuzzleProgressSnapshot {
  if (!isRecord(value) || !isRecord(value.entries) || !isRecord(value.selection)) {
    return false;
  }

  const hasValidEntries = Object.entries(value.entries).every(
    ([cellIndex, letter]) =>
      Number.isInteger(Number(cellIndex)) &&
      Number(cellIndex) >= 0 &&
      typeof letter === 'string' &&
      TURKISH_LETTER_PATTERN.test(letter),
  );

  return (
    value.schemaVersion === PUZZLE_PROGRESS_SCHEMA_VERSION &&
    typeof value.puzzleId === 'string' &&
    value.puzzleId.length > 0 &&
    hasValidEntries &&
    Number.isInteger(value.selection.cellIndex) &&
    Number(value.selection.cellIndex) >= 0 &&
    typeof value.selection.wordId === 'string' &&
    value.selection.wordId.length > 0 &&
    hasValidWordIds(value.solvedWordIds) &&
    hasValidWordIds(value.revealedWordIds) &&
    typeof value.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(value.updatedAt))
  );
}

export function parsePuzzleProgress(serialized: string): PuzzleProgressSnapshot | null {
  try {
    const value: unknown = JSON.parse(serialized);
    return isPuzzleProgressSnapshot(value) ? value : null;
  } catch {
    return null;
  }
}

export function serializePuzzleProgress(progress: PuzzleProgressSnapshot): string {
  if (!isPuzzleProgressSnapshot(progress)) {
    throw new Error('Cannot save invalid puzzle progress.');
  }

  return JSON.stringify(progress);
}

export function createPuzzleProgressSnapshot(
  puzzleId: string,
  state: PuzzleProgressState,
  updatedAt = new Date().toISOString(),
): PuzzleProgressSnapshot {
  return {
    entries: Object.fromEntries(
      Object.entries(state.entries).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    ),
    puzzleId,
    revealedWordIds: [...state.revealedWordIds].sort(),
    schemaVersion: PUZZLE_PROGRESS_SCHEMA_VERSION,
    selection: { ...state.selection },
    solvedWordIds: [...state.solvedWordIds].sort(),
    updatedAt,
  };
}

export function getPuzzleProgressSummary(
  puzzle: ProgressSummaryPuzzle,
  progress?: PuzzleProgressSnapshot | null,
): PuzzleProgressSummary {
  const totalWordCount = puzzle.words.length;

  if (!progress || progress.puzzleId !== puzzle.id) {
    return {
      completionPercentage: 0,
      revealedWordCount: 0,
      solvedWordCount: 0,
      status: 'not-started',
      totalWordCount,
    };
  }

  const validWordIds = new Set(puzzle.words.map(({ id }) => id));
  const solvedWordCount = new Set(progress.solvedWordIds.filter((id) => validWordIds.has(id)))
    .size;
  const revealedWordCount = new Set(
    progress.revealedWordIds.filter((id) => validWordIds.has(id)),
  ).size;
  const completionPercentage =
    totalWordCount === 0 ? 0 : Math.round((solvedWordCount / totalWordCount) * 100);

  return {
    completionPercentage,
    revealedWordCount,
    solvedWordCount,
    status: solvedWordCount === totalWordCount ? 'completed' : 'in-progress',
    totalWordCount,
  };
}

export function restorePuzzleProgress(
  puzzle: ProgressPuzzle,
  progress: PuzzleProgressSnapshot,
): RestoredPuzzleProgress | null {
  if (progress.puzzleId !== puzzle.id) {
    return null;
  }

  const wordById = new Map(puzzle.words.map((word) => [word.id, word]));
  const selectedWord = wordById.get(progress.selection.wordId);
  const solvedWordIds = new Set(progress.solvedWordIds);
  const revealedWordIds = new Set(progress.revealedWordIds);
  const entries = { ...progress.entries };
  const entriesAreValid = Object.keys(entries).every((cellIndex) => {
    const numericCellIndex = Number(cellIndex);
    return puzzle.cells[numericCellIndex]?.type === 'letter';
  });
  const wordIdsAreValid = [...solvedWordIds, ...revealedWordIds].every((wordId) =>
    wordById.has(wordId),
  );
  const revealedWordsAreSolved = [...revealedWordIds].every((wordId) =>
    solvedWordIds.has(wordId),
  );
  const solvedAnswersAreValid = [...solvedWordIds].every((wordId) => {
    const word = wordById.get(wordId);
    return word?.cellIndices.map((cellIndex) => entries[cellIndex]).join('') === word?.answer;
  });

  if (
    !selectedWord?.cellIndices.includes(progress.selection.cellIndex) ||
    !entriesAreValid ||
    !wordIdsAreValid ||
    !revealedWordsAreSolved ||
    !solvedAnswersAreValid
  ) {
    return null;
  }

  return {
    entries,
    revealedWordIds,
    selection: { ...progress.selection },
    solvedWordIds,
  };
}

export function createMemoryPuzzleProgressStore(): PuzzleProgressStore {
  const serializedByPuzzleId = new Map<string, string>();

  return {
    async list() {
      return [...serializedByPuzzleId.values()]
        .map(parsePuzzleProgress)
        .filter((progress): progress is PuzzleProgressSnapshot => progress !== null)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async load(puzzleId) {
      const serialized = serializedByPuzzleId.get(puzzleId);
      return serialized ? parsePuzzleProgress(serialized) : null;
    },
    async remove(puzzleId) {
      serializedByPuzzleId.delete(puzzleId);
    },
    async save(progress) {
      serializedByPuzzleId.set(progress.puzzleId, serializePuzzleProgress(progress));
    },
  };
}
