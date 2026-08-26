import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AnswerStartArrow } from '@/components/cengel/clue-arrow';
import { layout, palette, spacing, typography } from '@/constants/design';
import type {
  PuzzleClueSummary,
  PuzzleDefinition,
  PuzzleEntries,
} from '@cengel/puzzle-core/puzzle';

function SplitClueCell({
  cellSize,
  clues,
}: {
  cellSize: number;
  clues: readonly [PuzzleClueSummary, PuzzleClueSummary];
}) {
  const [topClue, bottomClue] = clues;
  const clueFontSize = Math.max(6, Math.min(10, cellSize * 0.18));
  const clueTextSize = {
    fontSize: clueFontSize,
    lineHeight: Math.ceil(clueFontSize * 1.1),
  };

  return (
    <View
      style={[
        styles.cell,
        styles.clueCell,
        styles.splitClueCell,
        { height: cellSize, width: cellSize },
      ]}>
      <View style={styles.splitDivider} />
      <View style={styles.splitClueContent}>
        <View style={[styles.splitClueRow, styles.splitClueTopRow]}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            numberOfLines={2}
            style={[styles.splitClueText, clueTextSize]}>
            {topClue.label}
          </Text>
        </View>
        <View style={styles.splitClueRow}>
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.85}
            numberOfLines={2}
            style={[styles.splitClueText, clueTextSize]}>
            {bottomClue.label}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ClueCell({
  cellSize,
  label,
}: PuzzleClueSummary & { cellSize: number }) {
  const clueFontSize = Math.max(6, Math.min(10, cellSize * 0.18));

  return (
    <View style={[styles.cell, styles.clueCell, { height: cellSize, width: cellSize }]}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.85}
        numberOfLines={4}
        style={[
          styles.clueText,
          {
            fontSize: clueFontSize,
            lineHeight: Math.ceil(clueFontSize * 1.1),
          },
        ]}>
        {label}
      </Text>
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
  startingWords,
  value,
}: {
  activeCell?: boolean;
  activeWord?: boolean;
  cellIndex: number;
  cellSize: number;
  columnCount: number;
  onPress?: () => void;
  startingWords: PuzzleDefinition['words'];
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
      {startingWords.map((word) => (
        <AnswerStartArrow
          arrow={word.clueArrow}
          cellSize={cellSize}
          direction={word.direction}
          key={word.id}
        />
      ))}
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
                  arrow={cell.arrow}
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
                startingWords={puzzle.words.filter(
                  ({ cellIndices }) => cellIndices[0] === cellKey,
                )}
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
    justifyContent: 'center',
    overflow: 'hidden',
    padding: 2,
  },
  clueText: {
    ...typography.gridHint,
    color: palette.ink,
    includeFontPadding: false,
    paddingHorizontal: 1,
    textAlign: 'center',
    textAlignVertical: 'center',
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
    padding: 2,
  },
  splitDivider: {
    backgroundColor: palette.gridLine,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: '50%',
  },
  splitClueContent: {
    flex: 1,
    width: '100%',
  },
  splitClueRow: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  splitClueTopRow: {
    borderBottomColor: palette.gridLine,
    borderBottomWidth: 1,
  },
  splitClueText: {
    ...typography.gridHint,
    color: palette.ink,
    includeFontPadding: false,
    textAlign: 'center',
    textAlignVertical: 'center',
    width: '100%',
  },
});
