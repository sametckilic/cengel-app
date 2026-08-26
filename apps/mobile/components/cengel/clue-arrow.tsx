import { View } from 'react-native';
import Svg, { Path, Polygon } from 'react-native-svg';

import { palette } from '@/constants/design';
import {
  getPuzzleClueArrow,
  type PuzzleClueArrow,
  type PuzzleDirection,
} from '@cengel/puzzle-core/puzzle';

type AnswerStartArrowProps = {
  active?: boolean;
  arrow?: PuzzleClueArrow;
  cellSize: number;
  direction: PuzzleDirection;
};

const ARROW_PATHS: Record<PuzzleClueArrow, { path: string; points: string }> = {
  right: {
    path: 'M0 12 H18',
    points: '17,7 23,12 17,17',
  },
  down: {
    path: 'M12 0 V18',
    points: '7,17 12,23 17,17',
  },
  'right-down': {
    path: 'M0 5 H9 Q13 5 13 9 V18',
    points: '8,17 13,23 18,17',
  },
  'down-right': {
    path: 'M5 0 V9 Q5 13 9 13 H18',
    points: '17,8 23,13 17,18',
  },
};

export function AnswerStartArrow({
  active = false,
  arrow,
  cellSize,
  direction,
}: AnswerStartArrowProps) {
  const resolvedArrow = getPuzzleClueArrow({ arrow, direction });
  const geometry = ARROW_PATHS[resolvedArrow];
  const color = active ? palette.secondary : palette.ink;
  const size = Math.max(8, Math.min(12, Math.round(cellSize * 0.2)));
  const position =
    resolvedArrow === 'right'
      ? {
          left: -1,
          top: cellSize / 2 - size / 2,
        }
      : resolvedArrow === 'down'
        ? {
            left: cellSize / 2 - size / 2,
            top: -1,
          }
        : resolvedArrow === 'right-down'
          ? {
              left: -1,
              top: -1,
            }
          : {
              left: -1,
              top: -1,
            };

  return (
    <View
      style={[
        { pointerEvents: 'none', position: 'absolute', zIndex: 2 },
        position,
      ]}>
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
    </View>
  );
}
