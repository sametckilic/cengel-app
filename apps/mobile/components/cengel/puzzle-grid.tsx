import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { layout, palette, spacing, typography } from '@/constants/design';
import type {
  PuzzleClueSummary,
  PuzzleDefinition,
  PuzzleDirection,
  PuzzleEntries,
} from '@cengel/puzzle-core/puzzle';

function getDirectionIcon(direction: PuzzleDirection) {
  return direction === 'right' ? 'arrow-right-alt' : 'arrow-downward';
}

function DirectionArrow({
  direction,
  compact = false,
}: {
  direction: PuzzleDirection;
  compact?: boolean;
}) {
  return (
    <MaterialIcons
      color={palette.ink}
      name={getDirectionIcon(direction)}
      size={compact ? 12 : 16}
    />
  );
}

function SplitClueCell({
  cellSize,
  clues,
}: {
  cellSize: number;
  clues: readonly [PuzzleClueSummary, PuzzleClueSummary];
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
      <View
        style={[
          styles.diagonalDivider,
          {
            left: -cellSize * 0.2,
            top: cellSize / 2,
            width: cellSize * 1.4,
          },
        ]}
      />
      <View style={styles.splitClueContent}>
        <View style={[styles.splitClueRow, styles.splitClueTopRow]}>
          <Text numberOfLines={1} style={styles.splitClueText}>
            {topClue.label}
          </Text>
          <DirectionArrow compact direction={topClue.direction} />
        </View>
        <View style={styles.splitClueRow}>
          <Text numberOfLines={1} style={styles.splitClueText}>
            {bottomClue.label}
          </Text>
          <DirectionArrow compact direction={bottomClue.direction} />
        </View>
      </View>
    </View>
  );
}

function ClueCell({
  cellSize,
  direction,
  label,
}: {
  cellSize: number;
  direction: PuzzleDirection;
  label: string;
}) {
  return (
    <View style={[styles.cell, styles.clueCell, { height: cellSize, width: cellSize }]}>
      <Text numberOfLines={4} style={styles.clueText}>
        {label}
      </Text>
      <View style={direction === 'right' ? styles.rightArrow : styles.downArrow}>
        <DirectionArrow direction={direction} />
      </View>
    </View>
  );
}

function LetterCell({
  activeCell,
  activeWord,
  cellIndex,
  cellSize,
  columnCount,
  onPress,
  value,
}: {
  activeCell?: boolean;
  activeWord?: boolean;
  cellIndex: number;
  cellSize: number;
  columnCount: number;
  onPress?: () => void;
  value?: string;
}) {
  const row = Math.floor(cellIndex / columnCount) + 1;
  const column = (cellIndex % columnCount) + 1;

  return (
    <Pressable
      accessibilityLabel={`${row}. satır, ${column}. sütun${value ? `, ${value}` : ', boş'}`}
      accessibilityRole="button"
      accessibilityState={{ selected: activeCell }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.cell,
        styles.letterCell,
        activeWord && styles.activeWord,
        activeCell && styles.activeCell,
        pressed && styles.letterCellPressed,
        { height: cellSize, width: cellSize },
      ]}>
      {value ? <Text style={styles.letter}>{value}</Text> : null}
    </Pressable>
  );
}

type PuzzleGridProps = {
  activeCellIndex: number;
  activeWordCellIndices: readonly number[];
  entries: PuzzleEntries;
  onActiveCellPress: (cellIndex: number) => void;
  puzzle: PuzzleDefinition;
};

export function PuzzleGrid({
  activeCellIndex,
  activeWordCellIndices,
  entries,
  onActiveCellPress,
  puzzle,
}: PuzzleGridProps) {
  const { width } = useWindowDimensions();
  const horizontalCanvasPadding = spacing.tight * 4;
  const gridSize = Math.min(layout.maxGrid, Math.max(408, width - horizontalCanvasPadding));
  const cellSize = Math.max(
    0,
    (gridSize - spacing.grid * 2 - spacing.grid * (puzzle.columnCount - 1)) /
      puzzle.columnCount,
  );
  const gridHeight =
    cellSize * puzzle.rowCount + spacing.grid * (puzzle.rowCount - 1) + spacing.grid * 2;
  const rows = Array.from({ length: puzzle.rowCount }, (_, rowIndex) =>
    puzzle.cells.slice(
      rowIndex * puzzle.columnCount,
      (rowIndex + 1) * puzzle.columnCount,
    ),
  );

  return (
    <View
      accessibilityLabel={`${puzzle.rowCount} satıra ${puzzle.columnCount} sütun çengel bulmaca ızgarası`}
      style={[styles.grid, { height: gridHeight, width: gridSize }]}>
      {rows.map((row, rowIndex) => (
        <View key={rowIndex} style={[styles.gridRow, { height: cellSize }]}>
          {row.map((cell, columnIndex) => {
            const cellKey = rowIndex * puzzle.columnCount + columnIndex;

            if (cell.type === 'void') {
              return (
                <View
                  key={cellKey}
                  style={[styles.cell, styles.voidCell, { height: cellSize, width: cellSize }]}
                />
              );
            }

            if (cell.type === 'split-clue') {
              return <SplitClueCell cellSize={cellSize} clues={cell.clues} key={cellKey} />;
            }

            if (cell.type === 'clue') {
              return (
                <ClueCell
                  cellSize={cellSize}
                  direction={cell.direction}
                  key={cellKey}
                  label={cell.label}
                />
              );
            }

            return (
              <LetterCell
                activeCell={activeCellIndex === cellKey}
                activeWord={activeWordCellIndices.includes(cellKey)}
                cellIndex={cellKey}
                columnCount={puzzle.columnCount}
                cellSize={cellSize}
                key={cellKey}
                onPress={
                  activeWordCellIndices.includes(cellKey)
                    ? () => onActiveCellPress(cellKey)
                    : undefined
                }
                value={entries[cellKey]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    alignSelf: 'center',
    backgroundColor: 'transparent',
    gap: spacing.grid,
    padding: spacing.grid,
  },
  gridRow: {
    flexDirection: 'row',
    gap: spacing.grid,
  },
  cell: {
    position: 'relative',
  },
  letterCell: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    justifyContent: 'center',
    padding: spacing.cell,
  },
  letter: {
    ...typography.gridInput,
    color: palette.ink,
    textAlign: 'center',
  },
  letterCellPressed: {
    backgroundColor: palette.surfaceHigh,
  },
  voidCell: {
    backgroundColor: 'transparent',
  },
  clueCell: {
    alignItems: 'center',
    backgroundColor: palette.cellLocked,
    justifyContent: 'flex-start',
    overflow: 'hidden',
    padding: 2,
  },
  clueText: {
    ...typography.gridHint,
    color: palette.ink,
    marginTop: 2,
    paddingHorizontal: 1,
    textAlign: 'center',
  },
  rightArrow: {
    bottom: 0,
    justifyContent: 'center',
    position: 'absolute',
    right: 2,
    top: 0,
  },
  downArrow: {
    alignItems: 'center',
    bottom: 2,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  activeWord: {
    backgroundColor: palette.selectionBlue,
  },
  activeCell: {
    borderColor: palette.primary,
    borderWidth: 2,
    zIndex: 1,
  },
  splitClueCell: {
    padding: 3,
  },
  diagonalDivider: {
    backgroundColor: palette.outlineVariant,
    height: 1,
    position: 'absolute',
    transform: [{ rotate: '-45deg' }],
  },
  splitClueContent: {
    flex: 1,
    width: '100%',
  },
  splitClueRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  splitClueTopRow: {
    borderBottomColor: palette.gridLine,
    borderBottomWidth: 1,
  },
  splitClueText: {
    ...typography.gridHint,
    color: palette.ink,
  },
});
