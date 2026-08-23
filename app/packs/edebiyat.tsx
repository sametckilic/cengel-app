import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditorialHeader } from '@/components/cengel/editorial-header';
import { EditorialIcon } from '@/components/cengel/editorial-icon';
import { fonts, layout, palette, spacing, typography } from '@/constants/design';
import {
  getDifficultyLabel,
  getPuzzleHref,
  getPuzzleSizeLabel,
} from '@/data/puzzle-catalog';
import { usePuzzleProgressCatalog } from '@/hooks/use-puzzle-progress-catalog';
import { usePuzzleCatalog } from '@/providers/puzzle-catalog-provider';

function PuzzleLabel({ number, title }: { number: number; title: string }) {
  return (
    <View style={styles.puzzleLabel}>
      <Text style={styles.puzzleNumber}>Bulmaca {number}</Text>
      <Text style={styles.puzzleTitle}>{title}</Text>
    </View>
  );
}

export default function EdebiyatPackScreen() {
  const router = useRouter();
  const { puzzles } = usePuzzleCatalog();
  const { getSummary } = usePuzzleProgressCatalog();
  const literaturePuzzles = useMemo(
    () =>
      puzzles.filter(
        (puzzle) => puzzle.categories.length === 1 && puzzle.categories[0] === 'edebiyat',
      ),
    [puzzles],
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <EditorialHeader
        bleedLeftAction
        leftIcon="arrow-back"
        leftLabel="Geri Dön"
        onLeftPress={() => router.back()}
        title="Edebiyat Paketi"
        variant="page"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.introCard}>
            <Text
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={styles.ampersand}>
              &amp;
            </Text>

            <View>
              <Text style={styles.packTitle}>Edebiyat</Text>
              <Text style={styles.packCount}>{literaturePuzzles.length} Özel Bulmaca</Text>
            </View>

            <Text style={styles.description}>
              Türk ve Dünya edebiyatının unutulmaz eserleri ve yazarları üzerine kurgulanmış
              derinlemesine bir yolculuk.
            </Text>
          </View>

          <View>
            <Text style={styles.listHeading}>Bulmacalar</Text>

            <View style={styles.puzzleList}>
              {literaturePuzzles.map((puzzle, index) => {
                const progress = getSummary(puzzle.id);

                return (
                  <Pressable
                    accessibilityHint={`${puzzle.title} bulmacasını açar`}
                    accessibilityLabel={[
                      `Bulmaca ${index + 1}`,
                      puzzle.title,
                      getPuzzleSizeLabel(puzzle),
                      getDifficultyLabel(puzzle.difficulty),
                    ].join(', ')}
                    key={puzzle.id}
                    onPress={() => router.push(getPuzzleHref(puzzle.id))}
                    style={({ pressed }) => [
                      styles.puzzleRow,
                      index === literaturePuzzles.length - 1 && styles.lastRow,
                      pressed && styles.puzzleRowPressed,
                    ]}>
                    <PuzzleLabel number={index + 1} title={puzzle.title} />
                    <View style={styles.rowProgressStatus}>
                      <Text style={styles.rowProgressValue}>
                        {getPuzzleSizeLabel(puzzle)} · {getDifficultyLabel(puzzle.difficulty)}
                        {progress.status !== 'not-started'
                          ? ` · ${progress.solvedWordCount}/${progress.totalWordCount}`
                          : ''}
                      </Text>
                      <EditorialIcon
                        color={palette.secondary}
                        name={progress.status === 'completed' ? 'check' : 'play-arrow'}
                        size={20}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.section,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.section,
    maxWidth: layout.maxDetail,
    paddingHorizontal: spacing.page,
    paddingTop: spacing.section,
    width: '100%',
  },
  introCard: {
    backgroundColor: palette.surface,
    borderColor: palette.gridLine,
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    overflow: 'hidden',
    padding: 24,
    position: 'relative',
  },
  ampersand: {
    color: palette.gridLine,
    fontFamily: fonts.playfairRegular,
    fontSize: 120,
    lineHeight: 144,
    opacity: 0.1,
    pointerEvents: 'none',
    position: 'absolute',
    right: -48,
    top: -48,
  },
  packTitle: {
    color: palette.primary,
    fontFamily: fonts.playfairBold,
    fontSize: 32,
    lineHeight: 40,
    marginBottom: 4,
  },
  packCount: {
    ...typography.caption,
    color: palette.accentRed,
    textTransform: 'uppercase',
  },
  description: {
    color: palette.onSurfaceVariant,
    fontFamily: typography.bodyClue.fontFamily,
    fontSize: 14,
    lineHeight: 22.75,
    width: '90%',
  },
  listHeading: {
    ...typography.caption,
    color: palette.onSurfaceVariant,
    marginBottom: 16,
    paddingLeft: spacing.tight,
    textTransform: 'uppercase',
  },
  puzzleList: {
    backgroundColor: palette.surface,
    borderColor: palette.gridLine,
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  puzzleRow: {
    alignItems: 'center',
    borderBottomColor: palette.gridLine,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    width: '100%',
  },
  puzzleRowPressed: {
    backgroundColor: palette.cellLocked,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  puzzleLabel: {
    gap: 4,
  },
  puzzleNumber: {
    ...typography.caption,
    color: palette.onSurfaceVariant,
  },
  puzzleTitle: {
    ...typography.bodyClue,
    color: palette.primary,
    fontFamily: fonts.interSemiBold,
  },
  rowProgressStatus: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.tight,
  },
  rowProgressValue: {
    ...typography.caption,
    color: palette.secondary,
    fontFamily: fonts.interSemiBold,
  },
});
