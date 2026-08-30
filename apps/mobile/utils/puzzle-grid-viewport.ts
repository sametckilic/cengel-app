export function getGridTranslationLimit(
  gridSize: number,
  viewportSize: number,
  scale: number,
) {
  'worklet';

  return Math.max(0, (gridSize * scale - viewportSize) / 2);
}

export function getPuzzleGridCellSize(
  availableWidth: number,
  columnCount: number,
  minimumCellSize = 24,
  gridBorderSize = 4,
) {
  return Math.max(
    minimumCellSize,
    Math.floor((availableWidth - gridBorderSize) / columnCount),
  );
}

export function clampGridTranslation(value: number, limit: number) {
  'worklet';

  return Math.max(-limit, Math.min(limit, value));
}

export function getPinchAnchoredTranslation(
  startTranslation: number,
  startFocalPoint: number,
  currentFocalPoint: number,
  viewportCenter: number,
  startScale: number,
  nextScale: number,
) {
  'worklet';

  const scaleRatio = nextScale / startScale;

  return (
    currentFocalPoint -
    viewportCenter -
    (startFocalPoint - viewportCenter - startTranslation) * scaleRatio
  );
}
