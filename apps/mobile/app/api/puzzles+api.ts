import { BUNDLED_PUZZLE_MANIFEST } from '@/data/puzzle-catalog';
import { createPuzzleCatalogApiResponse } from '@cengel/contracts/puzzle-api';

const responseBody = createPuzzleCatalogApiResponse(BUNDLED_PUZZLE_MANIFEST);
const entityTag = `"${responseBody.catalogVersion}"`;
const cacheHeaders = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=86400',
  ETag: entityTag,
};

export function GET(request: Request) {
  if (request.headers.get('If-None-Match') === entityTag) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }

  return Response.json(responseBody, { headers: cacheHeaders });
}
