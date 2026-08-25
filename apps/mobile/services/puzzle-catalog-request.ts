export function createPuzzleCatalogRequestHeaders(
  entityTag?: string,
  accessToken?: string,
): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(entityTag ? { 'If-None-Match': entityTag } : {}),
  };
}
