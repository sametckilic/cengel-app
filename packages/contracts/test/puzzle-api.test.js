import assert from 'node:assert/strict';
import test from 'node:test';

import previewManifest from '../../../apps/mobile/data/generated/newspaper-v2-preview.json' with {
  type: 'json',
};
import {
  createPuzzleCatalogApiResponse,
  createPuzzlePublicationDescriptor,
  isPuzzleCatalogApiResponse,
} from '../src/puzzle-api.ts';

test('derives daily, archive, and pack metadata from publication keys', () => {
  assert.deepEqual(
    createPuzzlePublicationDescriptor({
      publicationDate: '2026-08-29',
      publicationKey: 'daily',
      puzzleId: 'gunun-2026-08-29',
      requiredEntitlement: null,
    }),
    {
      channel: 'daily',
      publicationDate: '2026-08-29',
      puzzleId: 'gunun-2026-08-29',
      requiredEntitlement: null,
    },
  );
  assert.deepEqual(
    createPuzzlePublicationDescriptor({
      publicationDate: '2026-08-29',
      publicationKey: 'archive:arsiv-kolay-001',
      puzzleId: 'arsiv-kolay-001',
      requiredEntitlement: 'premium_access',
    }),
    {
      channel: 'archive',
      publicationDate: '2026-08-29',
      puzzleId: 'arsiv-kolay-001',
      requiredEntitlement: 'premium_access',
    },
  );
  assert.deepEqual(
    createPuzzlePublicationDescriptor({
      publicationDate: '2026-08-29',
      publicationKey: 'pack:kultur-sanat:2',
      puzzleId: 'kultur-sanat-002',
      requiredEntitlement: 'premium_access',
    }),
    {
      channel: 'pack',
      packId: 'kultur-sanat',
      publicationDate: '2026-08-29',
      puzzleId: 'kultur-sanat-002',
      puzzleNumber: 2,
      requiredEntitlement: 'premium_access',
    },
  );
});

test('rejects inconsistent and unsupported publication identities', () => {
  assert.throws(
    () =>
      createPuzzlePublicationDescriptor({
        publicationDate: '2026-08-29',
        publicationKey: 'daily',
        puzzleId: 'wrong-id',
        requiredEntitlement: null,
      }),
    /inconsistent/,
  );
  assert.throws(
    () =>
      createPuzzlePublicationDescriptor({
        publicationDate: '2026-08-29',
        publicationKey: 'catalog:legacy',
        puzzleId: 'legacy',
        requiredEntitlement: null,
      }),
    /Unsupported puzzle publication key/,
  );
});

test('validates catalog publication metadata against its manifest', () => {
  const [puzzle] = previewManifest.puzzles;
  const publication = createPuzzlePublicationDescriptor({
    publicationDate: '2026-08-29',
    publicationKey: `archive:${puzzle.id}`,
    puzzleId: puzzle.id,
    requiredEntitlement: 'premium_access',
  });
  const response = createPuzzleCatalogApiResponse(previewManifest, [publication]);

  assert.equal(isPuzzleCatalogApiResponse(response), true);
  assert.equal(
    isPuzzleCatalogApiResponse({
      ...response,
      publications: [{ ...publication, puzzleId: 'missing-puzzle' }],
    }),
    false,
  );
  assert.equal(
    isPuzzleCatalogApiResponse({
      ...response,
      publications: [
        {
          channel: 'daily',
          publicationDate: '2026-08-29',
          puzzleId: puzzle.id,
          requiredEntitlement: null,
        },
      ],
    }),
    false,
  );
});
