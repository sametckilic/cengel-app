import Svg, { Path, Polygon } from 'react-native-svg';

import { palette } from '@/constants/design';
import {
  getPuzzleClueArrow,
  type PuzzleClueArrow,
  type PuzzleDirection,
} from '@cengel/puzzle-core/puzzle';

type ClueArrowProps = {
  active?: boolean;
  arrow?: PuzzleClueArrow;
  direction: PuzzleDirection;
  size: number;
};

const ARROW_PATHS: Record<
  PuzzleClueArrow,
  { path: string; points: string }
> = {
  right: {
    path: 'M2.5 12 H18',
    points: '17,7 23,12 17,17',
  },
  down: {
    path: 'M12 2.5 V18',
    points: '7,17 12,23 17,17',
  },
  'right-down': {
    path: 'M2.5 6 H14 Q18 6 18 10 V18',
    points: '13,17 18,23 23,17',
  },
  'down-right': {
    path: 'M6 2.5 V14 Q6 18 10 18 H18',
    points: '17,13 23,18 17,23',
  },
};

export function ClueArrow({
  active = false,
  arrow,
  direction,
  size,
}: ClueArrowProps) {
  const resolvedArrow = getPuzzleClueArrow({ arrow, direction });
  const geometry = ARROW_PATHS[resolvedArrow];
  const color = active ? palette.secondary : palette.ink;

  return (
    <Svg
      accessibilityElementsHidden
      height={size}
      importantForAccessibility="no-hide-descendants"
      viewBox="0 0 24 24"
      width={size}>
      <Path
        d={geometry.path}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2.2}
      />
      <Polygon fill={color} points={geometry.points} />
    </Svg>
  );
}
