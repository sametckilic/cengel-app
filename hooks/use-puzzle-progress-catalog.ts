import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';

import { usePuzzleCatalog } from '@/providers/puzzle-catalog-provider';
import {
  getPuzzleProgressSummary,
  type PuzzleProgressSnapshot,
  type PuzzleProgressSummary,
} from '@/services/puzzle-progress';
import { puzzleProgressStore } from '@/services/puzzle-progress-store';

type PuzzleProgressCatalog = {
  getSummary: (puzzleId: string) => PuzzleProgressSummary;
  loading: boolean;
};

export function usePuzzleProgressCatalog(): PuzzleProgressCatalog {
  const { puzzles } = usePuzzleCatalog();
  const [progressByPuzzleId, setProgressByPuzzleId] = useState<
    ReadonlyMap<string, PuzzleProgressSnapshot>
  >(() => new Map());
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void puzzleProgressStore
        .list()
        .then((progressList) => {
          if (active) {
            setProgressByPuzzleId(
              new Map(progressList.map((progress) => [progress.puzzleId, progress])),
            );
          }
        })
        .catch(() => {
          if (active) {
            setProgressByPuzzleId(new Map());
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false);
          }
        });

      return () => {
        active = false;
      };
    }, []),
  );

  const summariesByPuzzleId = useMemo(
    () =>
      new Map(
        puzzles.map((puzzle) => [
          puzzle.id,
          getPuzzleProgressSummary(puzzle, progressByPuzzleId.get(puzzle.id)),
        ]),
      ),
    [progressByPuzzleId, puzzles],
  );

  const getSummary = useCallback(
    (puzzleId: string) => {
      const summary = summariesByPuzzleId.get(puzzleId);

      if (!summary) {
        throw new Error(`Puzzle progress requested for unknown puzzle "${puzzleId}".`);
      }

      return summary;
    },
    [summariesByPuzzleId],
  );

  return { getSummary, loading };
}
