export const PREMIUM_ACCESS_ENTITLEMENT = 'premium_access' as const;

export const CONTENT_PUBLICATION_POLICY = {
  archive: {
    requiredEntitlement: PREMIUM_ACCESS_ENTITLEMENT,
  },
  daily: {
    requiredEntitlement: null,
  },
  downloadedPuzzleAccess: {
    mode: 'retain',
    scope: 'local-profile',
  },
  pack: {
    freePuzzleCount: 1,
    requiredEntitlement: PREMIUM_ACCESS_ENTITLEMENT,
  },
} as const;

export type RequiredContentEntitlement =
  | typeof PREMIUM_ACCESS_ENTITLEMENT
  | null;

export type PublicationAccessRequest =
  | { channel: 'archive' }
  | { channel: 'daily' }
  | { channel: 'pack'; puzzleNumber: number };

/**
 * Resolves the entitlement stored on a puzzle publication.
 * Pack puzzle numbers are one-based so product copy and storage use the same
 * numbering: puzzle 1 is free, every later puzzle requires premium access.
 */
export function resolveRequiredEntitlement(
  publication: PublicationAccessRequest,
): RequiredContentEntitlement {
  if (publication.channel === 'daily') {
    return CONTENT_PUBLICATION_POLICY.daily.requiredEntitlement;
  }

  if (publication.channel === 'archive') {
    return CONTENT_PUBLICATION_POLICY.archive.requiredEntitlement;
  }

  if (
    !Number.isSafeInteger(publication.puzzleNumber) ||
    publication.puzzleNumber < 1
  ) {
    throw new RangeError('Pack puzzleNumber must be a positive integer.');
  }

  return publication.puzzleNumber <= CONTENT_PUBLICATION_POLICY.pack.freePuzzleCount
    ? null
    : CONTENT_PUBLICATION_POLICY.pack.requiredEntitlement;
}
