import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  BUNDLED_PUZZLE_MANIFEST,
  createPuzzleCatalog,
  findDailyPuzzle,
  findLatestDailyPuzzle,
  mergePuzzleManifests,
} from '@/data/puzzle-catalog';
import { createPuzzleCatalogApiResponse } from '@cengel/contracts/puzzle-api';
import { fetchPuzzleCatalog } from '@/services/puzzle-catalog-client';
import { puzzleCatalogStore } from '@/services/puzzle-catalog-store';
import type { PuzzleDefinition, PuzzleManifest } from '@cengel/puzzle-core/puzzle';

type PuzzleCatalogSource = 'bundled' | 'cache' | 'remote';

type PuzzleCatalogContextValue = {
  getDailyPuzzle: (date: Date) => PuzzleDefinition | undefined;
  getLatestDailyPuzzle: () => PuzzleDefinition | undefined;
  getPuzzleById: (id: string) => PuzzleDefinition | undefined;
  loading: boolean;
  puzzles: readonly PuzzleDefinition[];
  source: PuzzleCatalogSource;
};

const bundledResponse = createPuzzleCatalogApiResponse(BUNDLED_PUZZLE_MANIFEST);
const PuzzleCatalogContext = createContext<PuzzleCatalogContextValue | undefined>(
  undefined,
);

export function PuzzleCatalogProvider({ children }: PropsWithChildren) {
  const [manifest, setManifest] = useState<PuzzleManifest>(BUNDLED_PUZZLE_MANIFEST);
  const [source, setSource] = useState<PuzzleCatalogSource>('bundled');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function synchronizeCatalog() {
      let cachedEntityTag: string | undefined;

      try {
        const cached = await puzzleCatalogStore.load();

        if (cached && active) {
          cachedEntityTag = cached.entityTag;
          setManifest(mergePuzzleManifests(BUNDLED_PUZZLE_MANIFEST, cached.manifest));
          setSource('cache');
        }
      } catch {
        // The bundled manifest remains the safe offline fallback.
      }

      try {
        const result = await fetchPuzzleCatalog(cachedEntityTag, controller.signal);

        if (!active || result.status !== 'updated') {
          return;
        }

        const mergedManifest = mergePuzzleManifests(
          BUNDLED_PUZZLE_MANIFEST,
          result.response.manifest,
        );
        setManifest(mergedManifest);
        setSource('remote');
        await puzzleCatalogStore.save({
          ...result.response,
          cachedAt: new Date().toISOString(),
          entityTag: result.entityTag,
        });
      } catch {
        // Cache or bundled content remains available when the network is unavailable.
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void synchronizeCatalog();
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const value = useMemo<PuzzleCatalogContextValue>(() => {
    const puzzles = createPuzzleCatalog(manifest);

    return {
      getDailyPuzzle: (date) => findDailyPuzzle(puzzles, date),
      getLatestDailyPuzzle: () => findLatestDailyPuzzle(puzzles),
      getPuzzleById: (id) => puzzles.find((puzzle) => puzzle.id === id),
      loading,
      puzzles,
      source,
    };
  }, [loading, manifest, source]);

  return (
    <PuzzleCatalogContext.Provider value={value}>
      {children}
    </PuzzleCatalogContext.Provider>
  );
}

export function usePuzzleCatalog(): PuzzleCatalogContextValue {
  const value = useContext(PuzzleCatalogContext);

  if (!value) {
    throw new Error('usePuzzleCatalog must be used inside PuzzleCatalogProvider.');
  }

  return value;
}

export const BUNDLED_CATALOG_VERSION = bundledResponse.catalogVersion;
