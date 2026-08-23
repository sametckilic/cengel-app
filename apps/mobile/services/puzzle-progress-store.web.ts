import {
  createMemoryPuzzleProgressStore,
  parsePuzzleProgress,
  type PuzzleProgressSnapshot,
  type PuzzleProgressStore,
  serializePuzzleProgress,
} from '@/services/puzzle-progress';

const STORAGE_KEY = 'cengel:puzzle-progress:v1';
const memoryStore = createMemoryPuzzleProgressStore();

function readProgressByPuzzleId(): Record<string, PuzzleProgressSnapshot> {
  if (typeof window === 'undefined') {
    return {};
  }

  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);

    if (!serialized) {
      return {};
    }

    const value: unknown = JSON.parse(serialized);

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(value).flatMap(([puzzleId, progress]) => {
        const parsed = parsePuzzleProgress(JSON.stringify(progress));
        return parsed && parsed.puzzleId === puzzleId ? [[puzzleId, parsed]] : [];
      }),
    );
  } catch {
    return {};
  }
}

function writeProgressByPuzzleId(progressByPuzzleId: Record<string, PuzzleProgressSnapshot>) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressByPuzzleId));
}

export const puzzleProgressStore: PuzzleProgressStore = {
  async list() {
    if (typeof window === 'undefined') {
      return memoryStore.list();
    }

    return Object.values(readProgressByPuzzleId()).sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt),
    );
  },
  async load(puzzleId) {
    if (typeof window === 'undefined') {
      return memoryStore.load(puzzleId);
    }

    return readProgressByPuzzleId()[puzzleId] ?? null;
  },
  async remove(puzzleId) {
    if (typeof window === 'undefined') {
      return memoryStore.remove(puzzleId);
    }

    const progressByPuzzleId = readProgressByPuzzleId();
    delete progressByPuzzleId[puzzleId];
    writeProgressByPuzzleId(progressByPuzzleId);
  },
  async save(progress) {
    if (typeof window === 'undefined') {
      return memoryStore.save(progress);
    }

    const progressByPuzzleId = readProgressByPuzzleId();
    progressByPuzzleId[progress.puzzleId] = JSON.parse(
      serializePuzzleProgress(progress),
    ) as PuzzleProgressSnapshot;
    writeProgressByPuzzleId(progressByPuzzleId);
  },
};
