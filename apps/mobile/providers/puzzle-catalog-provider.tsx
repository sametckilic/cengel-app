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
import { getAuthenticatedAccess, getSupabaseClient } from '@/services/supabase-client';
import type { PuzzlePublicationDescriptor } from '@cengel/contracts/puzzle-api';
import type { PuzzleDefinition, PuzzleManifest } from '@cengel/puzzle-core/puzzle';

type PuzzleCatalogSource = 'bundled' | 'cache' | 'remote';

type PuzzleCatalogContextValue = {
  getDailyPuzzle: (date: Date) => PuzzleDefinition | undefined;
  getLatestDailyPuzzle: () => PuzzleDefinition | undefined;
  getPuzzleById: (id: string) => PuzzleDefinition | undefined;
  loading: boolean;
  publications: readonly PuzzlePublicationDescriptor[];
  puzzles: readonly PuzzleDefinition[];
  refreshCatalog: () => void;
  source: PuzzleCatalogSource;
};

const bundledResponse = createPuzzleCatalogApiResponse(BUNDLED_PUZZLE_MANIFEST);
const PuzzleCatalogContext = createContext<PuzzleCatalogContextValue | undefined>(
  undefined,
);

export function PuzzleCatalogProvider({ children }: PropsWithChildren) {
  const [manifest, setManifest] = useState<PuzzleManifest>(BUNDLED_PUZZLE_MANIFEST);
  const [publications, setPublications] = useState<
    readonly PuzzlePublicationDescriptor[]
  >(bundledResponse.publications);
  const [source, setSource] = useState<PuzzleCatalogSource>('bundled');
  const [loading, setLoading] = useState(true);
  const [syncRevision, setSyncRevision] = useState(0);

  useEffect(() => {
    const subscription = getSupabaseClient()?.auth.onAuthStateChange(() => {
      setSyncRevision((current) => current + 1);
    });

    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function synchronizeCatalog() {
      let cachedEntityTag: string | undefined;
      let accessToken: string | undefined;

      setLoading(true);

      try {
        accessToken = (await getAuthenticatedAccess())?.accessToken;
      } catch {
        // An invalid/expired session falls back to the anonymous catalog.
      }

      if (active) {
        setManifest(BUNDLED_PUZZLE_MANIFEST);
        setPublications(bundledResponse.publications);
        setSource('bundled');
      }

      if (!accessToken) {
        try {
          const cached = await puzzleCatalogStore.load();

          if (cached && active) {
            cachedEntityTag = cached.entityTag;
            setManifest(mergePuzzleManifests(BUNDLED_PUZZLE_MANIFEST, cached.manifest));
            setPublications(cached.publications);
            setSource('cache');
          }
        } catch {
          // The bundled manifest remains the safe offline fallback.
        }
      }

      try {
        const result = await fetchPuzzleCatalog(
          accessToken ? undefined : cachedEntityTag,
          controller.signal,
          accessToken,
        );

        if (!active || result.status !== 'updated') {
          return;
        }

        const mergedManifest = mergePuzzleManifests(
          BUNDLED_PUZZLE_MANIFEST,
          result.response.manifest,
        );
        setManifest(mergedManifest);
        setPublications(result.response.publications);
        setSource('remote');

        if (!accessToken) {
          await puzzleCatalogStore.save({
            ...result.response,
            cachedAt: new Date().toISOString(),
            entityTag: result.entityTag,
          });
        }
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
  }, [syncRevision]);

  const value = useMemo<PuzzleCatalogContextValue>(() => {
    const puzzles = createPuzzleCatalog(manifest);

    return {
      getDailyPuzzle: (date) => findDailyPuzzle(puzzles, date),
      getLatestDailyPuzzle: () => findLatestDailyPuzzle(puzzles),
      getPuzzleById: (id) => puzzles.find((puzzle) => puzzle.id === id),
      loading,
      publications,
      puzzles,
      refreshCatalog: () => setSyncRevision((current) => current + 1),
      source,
    };
  }, [loading, manifest, publications, source]);

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
