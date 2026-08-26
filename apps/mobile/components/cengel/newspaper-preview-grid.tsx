import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { fonts, layout, palette, spacing } from '@/constants/design';
import { ClueArrow } from '@/components/cengel/clue-arrow';
import type {
  PuzzleClueArrow,
  PuzzleClueSummary,
  PuzzleDefinition,
  PuzzleEntries,
} from '@cengel/puzzle-core/puzzle';
import {
  getPuzzleClueArrow,
  getPuzzleWordClueCellIndex,
} from '@cengel/puzzle-core/puzzle';
import { getWordsAtCell } from '@cengel/puzzle-core/puzzle-selection';

const MINIMUM_ZOOM_SCALE = 0.65;
const MAXIMUM_ZOOM_SCALE = 2.5;
const MINIMUM_RUBBER_BAND_SCALE = MINIMUM_ZOOM_SCALE * 0.78;
const MAXIMUM_RUBBER_BAND_SCALE = MAXIMUM_ZOOM_SCALE * 1.12;
const RUBBER_BAND_RESISTANCE = 0.22;
const ZOOM_LIMIT_SPRING = {
  damping: 18,
  mass: 0.7,
  reduceMotion: ReduceMotion.System,
  stiffness: 220,
} as const;

function arrowStartsRight(clue: PuzzleClueSummary) {
  const arrow = getPuzzleClueArrow(clue);
  return arrow === 'right' || arrow === 'right-down';
}

function SingleClueCell({
  active,
  arrow,
  cellSize,
  direction,
  label,
}: PuzzleClueSummary & { active: boolean; cellSize: number }) {
  const arrowSize = Math.max(8, Math.round(cellSize * 0.2));
  const fontSize = Math.max(7, Math.min(9, cellSize * 0.185));

  return (
    <View
      style={[
        styles.cell,
        styles.clueCell,
        active && styles.activeClueCell,
        { height: cellSize, width: cellSize },
      ]}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={4}
        style={[
          styles.clueText,
          active && styles.activeClueText,
          { fontSize, lineHeight: fontSize + 1.2 },
        ]}>
        {label}
      </Text>
      <View
        style={
          arrowStartsRight({ arrow, direction, label })
            ? styles.rightArrow
            : styles.downArrow
        }>
        <ClueArrow
          active={active}
          arrow={arrow}
          direction={direction}
          size={arrowSize}
        />
      </View>
    </View>
  );
}

function SplitClueSection({
  cellSize,
  clue,
  position,
  selected,
}: {
  cellSize: number;
  clue: PuzzleClueSummary;
  position: 'bottom' | 'top';
  selected: boolean;
}) {
  const fontSize = Math.max(5.5, Math.min(7.5, cellSize * 0.15));

  return (
    <View style={position === 'top' ? styles.splitTop : styles.splitBottom}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={2}
        style={[
          styles.splitClueText,
          selected && styles.activeClueText,
          { fontSize, lineHeight: fontSize + 0.8 },
        ]}>
        {clue.label}
      </Text>
      <ClueArrow
        active={selected}
        arrow={clue.arrow}
        direction={clue.direction}
        size={Math.max(7, cellSize * 0.16)}
      />
    </View>
  );
}

function SplitClueCell({
  cellSize,
  clues,
  selectedArrow,
}: {
  cellSize: number;
  clues: readonly [PuzzleClueSummary, PuzzleClueSummary];
  selectedArrow?: PuzzleClueArrow;
}) {
  const [topClue, bottomClue] = clues;

  return (
    <View
      style={[
        styles.cell,
        styles.clueCell,
        styles.splitClueCell,
        { height: cellSize, width: cellSize },
      ]}>
      <View style={styles.splitDivider} />
      <SplitClueSection
        cellSize={cellSize}
        clue={topClue}
        position="top"
        selected={selectedArrow === getPuzzleClueArrow(topClue)}
      />
      <SplitClueSection
        cellSize={cellSize}
        clue={bottomClue}
        position="bottom"
        selected={selectedArrow === getPuzzleClueArrow(bottomClue)}
      />
    </View>
  );
}

type NewspaperPreviewGridProps = {
  activeCellIndex: number;
  activeWordId: string;
  centerActiveCell: boolean;
  centerRequestKey: number;
  entries: PuzzleEntries;
  lockedCellIndices: ReadonlySet<number>;
  onActiveCellPositionChange: (centerY: number, bottomY: number) => void;
  onLetterCellPress: (cellIndex: number) => void;
  onZoomOverflowChange: (verticalOverflow: number) => void;
  puzzle: PuzzleDefinition;
  solvedWordIds: ReadonlySet<string>;
};

export function NewspaperPreviewGrid({
  activeCellIndex,
  activeWordId,
  centerActiveCell,
  centerRequestKey,
  entries,
  lockedCellIndices,
  onActiveCellPositionChange,
  onLetterCellPress,
  onZoomOverflowChange,
  puzzle,
  solvedWordIds,
}: NewspaperPreviewGridProps) {
  const { width } = useWindowDimensions();
  const viewportWidth = width > spacing.tight * 2 ? width : 390;
  const availableWidth = Math.min(layout.maxContent, viewportWidth - spacing.tight * 2);
  const cellSize = Math.max(32, Math.floor((availableWidth - 4) / puzzle.columnCount));
  const gridWidth = cellSize * puzzle.columnCount + 4;
  const gridHeight = cellSize * puzzle.rowCount + 4;
  const scale = useSharedValue(1);
  const pinchStartScale = useSharedValue(1);
  const translationX = useSharedValue(0);
  const translationY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);
  const activeCellRef = useRef<View>(null);
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      cancelAnimation(scale);
      cancelAnimation(translationX);
      cancelAnimation(translationY);
      pinchStartScale.value = scale.value;
    })
    .onUpdate((event) => {
      const requestedScale = pinchStartScale.value * event.scale;

      scale.value =
        requestedScale < MINIMUM_ZOOM_SCALE
          ? Math.max(
              MINIMUM_RUBBER_BAND_SCALE,
              MINIMUM_ZOOM_SCALE -
                (MINIMUM_ZOOM_SCALE - requestedScale) * RUBBER_BAND_RESISTANCE,
            )
          : requestedScale > MAXIMUM_ZOOM_SCALE
            ? Math.min(
                MAXIMUM_RUBBER_BAND_SCALE,
                MAXIMUM_ZOOM_SCALE +
                  (requestedScale - MAXIMUM_ZOOM_SCALE) * RUBBER_BAND_RESISTANCE,
              )
            : requestedScale;
    })
    .onFinalize(() => {
      const settledScale = Math.max(
        MINIMUM_ZOOM_SCALE,
        Math.min(MAXIMUM_ZOOM_SCALE, scale.value),
      );

      const maximumX = ((gridWidth - cellSize) * settledScale) / 2;
      const maximumY = ((gridHeight - cellSize) * settledScale) / 2;
      const settledTranslationX = Math.max(
        -maximumX,
        Math.min(maximumX, translationX.value),
      );
      const settledTranslationY = Math.max(
        -maximumY,
        Math.min(maximumY, translationY.value),
      );

      if (scale.value !== settledScale) {
        scale.value = withSpring(settledScale, ZOOM_LIMIT_SPRING);
      }

      if (translationX.value !== settledTranslationX) {
        translationX.value = withSpring(
          settledTranslationX,
          ZOOM_LIMIT_SPRING,
        );
      }

      if (translationY.value !== settledTranslationY) {
        translationY.value = withSpring(
          settledTranslationY,
          ZOOM_LIMIT_SPRING,
        );
      }

      scheduleOnRN(
        onZoomOverflowChange,
        Math.max(0, (gridHeight * settledScale - gridHeight) / 2),
      );
    });
  const panGesture = Gesture.Pan()
    .minDistance(8)
    .averageTouches(true)
    .onBegin(() => {
      cancelAnimation(translationX);
      cancelAnimation(translationY);
      panStartX.value = translationX.value;
      panStartY.value = translationY.value;
    })
    .onUpdate((event) => {
      const maximumX = ((gridWidth - cellSize) * scale.value) / 2;
      const maximumY = ((gridHeight - cellSize) * scale.value) / 2;
      translationX.value = Math.max(
        -maximumX,
        Math.min(maximumX, panStartX.value + event.translationX),
      );
      translationY.value = Math.max(
        -maximumY,
        Math.min(maximumY, panStartY.value + event.translationY),
      );
    });
  const gridGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const animatedGridStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translationX.value },
      { translateY: translationY.value },
      { scale: scale.value },
    ],
  }));
  const activeWord = puzzle.words.find(({ id }) => id === activeWordId);

  if (!activeWord) {
    throw new Error(`Puzzle is missing active word "${activeWordId}".`);
  }

  const activeClueCellIndex = getPuzzleWordClueCellIndex(
    activeWord,
    puzzle.columnCount,
  );
  const activeClueArrow = activeWord.clueArrow ?? activeWord.direction;

  useEffect(() => {
    if (!centerActiveCell) {
      return;
    }

    const measurementTimer = setTimeout(() => {
      activeCellRef.current?.measureInWindow((_x, y, _width, height) => {
        onActiveCellPositionChange(y + height / 2, y + height);
      });
    }, 0);

    return () => clearTimeout(measurementTimer);
  }, [
    activeCellIndex,
    centerActiveCell,
    centerRequestKey,
    onActiveCellPositionChange,
  ]);

  return (
    <View
      accessibilityLabel={`${puzzle.rowCount} satıra ${puzzle.columnCount} sütun gazete tipi çengel bulmaca`}
      accessibilityHint="Tek parmakla taşıyabilir, iki parmakla yakınlaştırıp uzaklaştırabilirsin."
      style={[styles.zoomViewport, { height: gridHeight, width: gridWidth }]}>
      <GestureDetector gesture={gridGesture}>
        <Animated.View style={animatedGridStyle}>
          <View style={[styles.grid, { height: gridHeight, width: gridWidth }]}>
            {puzzle.cells.map((cell, cellIndex) => {
              const isLocked = lockedCellIndices.has(cellIndex);

              if (cell.type === 'split-clue') {
                return (
                  <SplitClueCell
                    cellSize={cellSize}
                    clues={cell.clues}
                    key={cellIndex}
                    selectedArrow={
                      cellIndex === activeClueCellIndex
                        ? activeClueArrow
                        : undefined
                    }
                  />
                );
              }

              if (cell.type === 'clue') {
                return (
                  <SingleClueCell
                    cellSize={cellSize}
                    arrow={cell.arrow}
                    direction={cell.direction}
                    key={cellIndex}
                    label={cell.label}
                    active={cellIndex === activeClueCellIndex}
                  />
                );
              }

              if (cell.type === 'void') {
                return (
                  <View
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    key={cellIndex}
                    style={[styles.cell, styles.voidCell, { height: cellSize, width: cellSize }]}
                  />
                );
              }

              const letterFontSize = Math.max(18, cellSize * 0.45);
              const isPlayable = getWordsAtCell(puzzle, cellIndex).some(
                ({ id }) => !solvedWordIds.has(id),
              );

              return (
                <Pressable
                  ref={cellIndex === activeCellIndex ? activeCellRef : undefined}
                  accessibilityLabel={`${Math.floor(cellIndex / puzzle.columnCount) + 1}. satır, ${(cellIndex % puzzle.columnCount) + 1}. sütun${entries[cellIndex] ? `, ${entries[cellIndex]}` : ', boş'}${isLocked ? ', kilitli' : ''}`}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: !isPlayable,
                    selected: cellIndex === activeCellIndex,
                  }}
                  disabled={!isPlayable}
                  key={cellIndex}
                  onPress={() => onLetterCellPress(cellIndex)}
                  style={({ pressed }) => [
                    styles.cell,
                    styles.letterCell,
                    activeWord.cellIndices.includes(cellIndex) && styles.activeWordCell,
                    isLocked && styles.lockedLetterCell,
                    pressed && styles.pressedLetterCell,
                    { height: cellSize, width: cellSize },
                  ]}>
                  {entries[cellIndex] ? (
                    <Text
                      style={[
                        styles.letter,
                        !isLocked && styles.unconfirmedLetter,
                        {
                          fontSize: letterFontSize,
                          lineHeight: Math.round(letterFontSize * 1.1),
                        },
                      ]}>
                      {entries[cellIndex]}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    backgroundColor: palette.ink,
    borderColor: palette.ink,
    borderWidth: 2,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    borderColor: palette.ink,
    borderWidth: 0.5,
    position: 'relative',
  },
  letterCell: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    justifyContent: 'center',
  },
  voidCell: {
    backgroundColor: palette.paper,
    borderColor: palette.paper,
  },
  letter: {
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  unconfirmedLetter: {
    color: palette.secondary,
  },
  activeWordCell: {
    backgroundColor: palette.selectionBlue,
  },
  lockedLetterCell: {
    backgroundColor: palette.cellLocked,
  },
  pressedLetterCell: {
    backgroundColor: palette.surfaceHighest,
  },
  clueCell: {
    alignItems: 'center',
    backgroundColor: palette.surfaceHigh,
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 2,
  },
  clueText: {
    color: palette.ink,
    flexShrink: 1,
    fontFamily: fonts.interBold,
    includeFontPadding: false,
    paddingHorizontal: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  activeClueCell: {
    backgroundColor: palette.selectionBlue,
  },
  activeClueText: {
    color: palette.secondary,
  },
  rightArrow: {
    bottom: 1,
    position: 'absolute',
    right: 1,
  },
  downArrow: {
    alignItems: 'center',
    bottom: 1,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  splitClueCell: {
    padding: 0,
  },
  splitDivider: {
    backgroundColor: palette.ink,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  splitTop: {
    alignItems: 'center',
    flexDirection: 'row',
    height: '50%',
    justifyContent: 'center',
    left: 1,
    position: 'absolute',
    right: 1,
    top: 0,
  },
  splitBottom: {
    alignItems: 'center',
    bottom: 1,
    flexDirection: 'row',
    height: '50%',
    justifyContent: 'center',
    left: 1,
    position: 'absolute',
    right: 1,
  },
  splitClueText: {
    color: palette.ink,
    flex: 1,
    fontFamily: fonts.interBold,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  zoomViewport: {
    alignSelf: 'center',
    overflow: 'visible',
    zIndex: 10,
  },
});
