import previewManifest from '@/data/generated/newspaper-v2-preview.json';
import { isPuzzleManifest } from '@cengel/puzzle-core/puzzle-schema';
import type {
  NewspaperPuzzleDefinition,
  PuzzleDefinition,
  PuzzleManifest,
} from '@cengel/puzzle-core/puzzle';

const manifest: unknown = previewManifest;

if (!isPuzzleManifest(manifest)) {
  throw new Error(
    'Generated V2 preview manifest is invalid. Run `npm run newspaper:v2:preview:build`.',
  );
}

function isNewspaperPuzzle(
  puzzle: PuzzleDefinition,
): puzzle is NewspaperPuzzleDefinition {
  return 'format' in puzzle && puzzle.format === 'newspaper-arrowword';
}

export const NEWSPAPER_V2_PREVIEW_MANIFEST: PuzzleManifest = manifest;
export const NEWSPAPER_V2_PREVIEW_PUZZLES = manifest.puzzles.filter(
  isNewspaperPuzzle,
);

if (NEWSPAPER_V2_PREVIEW_PUZZLES.length !== manifest.puzzles.length) {
  throw new Error('Every V2 preview puzzle must use newspaper-arrowword format.');
}
