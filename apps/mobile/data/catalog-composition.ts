type CatalogEntry = {
  id: string;
};

export function composeCatalogWithFallback<T extends CatalogEntry>(
  fallback: T,
  entries: readonly T[],
): readonly T[] {
  const seenIds = new Set<string>();
  const catalogEntries: T[] = [];
  let resolvedFallback = fallback;

  for (const entry of entries) {
    if (seenIds.has(entry.id)) {
      throw new Error(`Duplicate puzzle id in shared catalog: "${entry.id}".`);
    }

    seenIds.add(entry.id);

    if (entry.id === fallback.id) {
      resolvedFallback = entry;
    } else {
      catalogEntries.push(entry);
    }
  }

  return [resolvedFallback, ...catalogEntries];
}
