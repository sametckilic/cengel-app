import {
  parsePuzzleCatalogCache,
  type PuzzleCatalogCacheSnapshot,
  type PuzzleCatalogCacheStore,
  serializePuzzleCatalogCache,
} from '@/services/puzzle-catalog-cache';

const STORAGE_KEY = 'cengel:puzzle-catalog:v1';
let memorySnapshot: PuzzleCatalogCacheSnapshot | null = null;

export const puzzleCatalogStore: PuzzleCatalogCacheStore = {
  async load() {
    if (typeof window === 'undefined') {
      return memorySnapshot;
    }

    const serialized = window.localStorage.getItem(STORAGE_KEY);
    return serialized ? parsePuzzleCatalogCache(serialized) : null;
  },
  async save(snapshot) {
    if (typeof window === 'undefined') {
      memorySnapshot = snapshot;
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, serializePuzzleCatalogCache(snapshot));
  },
};
