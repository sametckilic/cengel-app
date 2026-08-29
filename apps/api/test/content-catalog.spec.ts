import { describe, expect, it } from 'vitest';

import {
  createPublishedCatalogResult,
  type PublishedCatalogRow,
} from '../src/content/content.service';

function row(
  id: string,
  publicationKey: string,
  overrides: Partial<PublishedCatalogRow> = {},
): PublishedCatalogRow {
  return {
    checksum: `${id}-checksum`,
    definition: { id, marker: overrides.version ?? 1 },
    id,
    publicationDate: '2026-08-29',
    publicationKey,
    requiredEntitlement: null,
    version: 1,
    ...overrides,
  };
}

describe('published catalog metadata', () => {
  it('keeps the newest visible definition and derives publication channels', () => {
    const result = createPublishedCatalogResult(
      [
        row('gunun-2026-08-29', 'daily'),
        row('kultur-sanat-001', 'pack:kultur-sanat:1'),
        row('arsiv-kolay-001', 'archive:arsiv-kolay-001', {
          checksum: 'new-checksum',
          definition: { id: 'arsiv-kolay-001', marker: 2 },
          requiredEntitlement: 'premium_access',
          version: 2,
        }),
        row('arsiv-kolay-001', 'archive:arsiv-kolay-001'),
      ],
      'catalog-source',
    );

    expect(result.manifest.puzzles).toEqual([
      { id: 'gunun-2026-08-29', marker: 1 },
      { id: 'kultur-sanat-001', marker: 1 },
      { id: 'arsiv-kolay-001', marker: 2 },
    ]);
    expect(result.publications).toEqual([
      {
        channel: 'daily',
        publicationDate: '2026-08-29',
        puzzleId: 'gunun-2026-08-29',
        requiredEntitlement: null,
      },
      {
        channel: 'pack',
        packId: 'kultur-sanat',
        publicationDate: '2026-08-29',
        puzzleId: 'kultur-sanat-001',
        puzzleNumber: 1,
        requiredEntitlement: null,
      },
      {
        channel: 'archive',
        publicationDate: '2026-08-29',
        puzzleId: 'arsiv-kolay-001',
        requiredEntitlement: 'premium_access',
      },
    ]);
  });

  it('changes the catalog version when access metadata changes', () => {
    const free = createPublishedCatalogResult(
      [row('kultur-sanat-001', 'pack:kultur-sanat:1')],
      'catalog-source',
    );
    const premium = createPublishedCatalogResult(
      [
        row('kultur-sanat-001', 'pack:kultur-sanat:1', {
          requiredEntitlement: 'premium_access',
        }),
      ],
      'catalog-source',
    );

    expect(free.catalogVersion).not.toBe(premium.catalogVersion);
  });
});
