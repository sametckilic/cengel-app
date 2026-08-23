import { BUNDLED_PUZZLE_MANIFEST } from '@/data/puzzle-catalog';
import {
  createPuzzleApiResponse,
  createPuzzleCatalogApiResponse,
} from '@/services/puzzle-api-contract';

const catalogResponse = createPuzzleCatalogApiResponse(BUNDLED_PUZZLE_MANIFEST);
const entityTag = `"${catalogResponse.catalogVersion}"`;
const cacheHeaders = {
  'Cache-Control': 'public, max-age=60, stale-while-revalidate=86400',
  ETag: entityTag,
};

export function GET(request: Request, { id }: Record<string, string>) {
  const puzzle = BUNDLED_PUZZLE_MANIFEST.puzzles.find(
    (candidate) => candidate.id === id,
  );

  if (!puzzle) {
    return Response.json(
      { error: 'Puzzle not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (request.headers.get('If-None-Match') === entityTag) {
    return new Response(null, { status: 304, headers: cacheHeaders });
  }

  return Response.json(
    createPuzzleApiResponse(puzzle, catalogResponse.catalogVersion),
    { headers: cacheHeaders },
  );
}
