export type ProgressEventIdentity = {
  clientUpdatedAt: string;
  eventId: string;
};

export function shouldApplyProgressEvent(
  current: ProgressEventIdentity | null,
  incoming: ProgressEventIdentity,
): boolean {
  if (!current) {
    return true;
  }

  const timestampOrder = incoming.clientUpdatedAt.localeCompare(
    current.clientUpdatedAt,
  );

  if (timestampOrder !== 0) {
    return timestampOrder > 0;
  }

  return incoming.eventId.localeCompare(current.eventId) > 0;
}
