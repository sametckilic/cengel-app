import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditorialHeader } from '@/components/cengel/editorial-header';
import { EditorialIcon } from '@/components/cengel/editorial-icon';
import { SectionLabel } from '@/components/cengel/section-label';
import { fonts, layout, palette, spacing, typography } from '@/constants/design';
import {
  getDifficultyLabel,
  getPuzzleCategoryLabel,
  getPuzzleHref,
  getPuzzleSizeLabel,
} from '@/data/puzzle-catalog';
import { usePuzzleProgressCatalog } from '@/hooks/use-puzzle-progress-catalog';
import { usePuzzleCatalog } from '@/providers/puzzle-catalog-provider';
import type { PuzzleProgressSummary } from '@cengel/puzzle-core/puzzle-progress';

type ArchiveItem = {
  detail: string;
  difficulty: string;
  puzzleId: string;
  title: string;
};

function ArchiveRow({
  item,
  progress,
}: {
  item: ArchiveItem;
  progress: PuzzleProgressSummary;
}) {
  const router = useRouter();
  const progressDetail =
    progress.status === 'not-started'
      ? 'Başlanmadı'
      : `${progress.solvedWordCount}/${progress.totalWordCount} kelime`;
  const contents = (
    <>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDetail}>
          {item.detail} · {progressDetail}
        </Text>
      </View>
      <View style={styles.rowEnd}>
        <View style={styles.difficultyChip}>
          <Text style={styles.difficultyChipText}>{item.difficulty}</Text>
        </View>
        <EditorialIcon
          color={progress.status === 'not-started' ? palette.outline : palette.secondary}
          name={progress.status === 'completed' ? 'check-circle' : 'play-circle-outline'}
          size={24}
        />
      </View>
    </>
  );

  return (
    <Pressable
      accessibilityLabel={[item.title, item.detail, item.difficulty].join(', ')}
      onPress={() => router.push(getPuzzleHref(item.puzzleId))}
      style={({ pressed }) => [styles.archiveRow, pressed && styles.rowPressed]}>
      {contents}
    </Pressable>
  );
}

function ArchiveSection({
  items,
  getProgress,
  title,
}: {
  items: readonly ArchiveItem[];
  getProgress: (puzzleId: string) => PuzzleProgressSummary;
  title: string;
}) {
  return (
    <View style={styles.monthSection}>
      <View style={styles.monthHeading}>
        <SectionLabel style={styles.monthLabel}>{title}</SectionLabel>
      </View>
      <View>
        {items.map((item) => (
          <ArchiveRow item={item} key={item.puzzleId} progress={getProgress(item.puzzleId)} />
        ))}
      </View>
    </View>
  );
}

export default function ArchiveScreen() {
  const router = useRouter();
  const { puzzles } = usePuzzleCatalog();
  const { getSummary } = usePuzzleProgressCatalog();
  const archiveItems = useMemo<readonly ArchiveItem[]>(
    () =>
      puzzles.map((puzzle) => ({
        puzzleId: puzzle.id,
        title: puzzle.title,
        detail: `${getPuzzleSizeLabel(puzzle)} · ${puzzle.words.length} kelime · ${getPuzzleCategoryLabel(puzzle)}`,
        difficulty: getDifficultyLabel(puzzle.difficulty),
      })),
    [puzzles],
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <EditorialHeader
        leftIcon="menu"
        leftLabel="Menü"
        rightIcon="account-circle"
        rightLabel="Profil"
        onRightPress={() => router.push('/profile')}
        title="ÇENGEL"
        variant="brand"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.intro}>
            <Text style={styles.pageTitle}>Arşiv</Text>
            <Text style={styles.description}>
              Farklı boyut, kategori ve zorluklardaki hazır bulmacaları buradan açabilirsiniz.
            </Text>
          </View>

          <ArchiveSection
            getProgress={getSummary}
            items={archiveItems}
            title="HAZIR BULMACALAR"
          />
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
  scrollContainer: {
    paddingBottom: 64,
    paddingTop: spacing.section,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.section,
    maxWidth: layout.maxContent,
    paddingHorizontal: spacing.page,
    width: '100%',
  },
  intro: {
    marginBottom: 16,
  },
  pageTitle: {
    ...typography.headlineMd,
    color: palette.ink,
  },
  description: {
    ...typography.bodyClue,
    color: palette.outline,
    marginTop: spacing.tight,
  },
  monthSection: {
    gap: spacing.tight,
  },
  monthHeading: {
    borderBottomColor: palette.gridLine,
    borderBottomWidth: 1,
    marginBottom: spacing.tight,
    paddingBottom: spacing.tight,
  },
  monthLabel: {
    ...typography.caption,
    color: palette.outline,
    letterSpacing: 1.2,
  },
  archiveRow: {
    alignItems: 'center',
    borderBottomColor: palette.gridLineSoft,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 73,
    paddingVertical: 16,
  },
  rowPressed: {
    backgroundColor: palette.surfaceLow,
  },
  rowCopy: {
    flex: 1,
    paddingRight: 12,
  },
  rowTitle: {
    ...typography.bodyClue,
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
  },
  rowDetail: {
    ...typography.caption,
    color: palette.outline,
    marginTop: 4,
  },
  rowEnd: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  difficultyChip: {
    backgroundColor: palette.surfaceHigh,
    borderRadius: 4,
    paddingHorizontal: spacing.tight,
    paddingVertical: spacing.cell,
  },
  difficultyChipText: {
    ...typography.caption,
    color: palette.onSurfaceVariant,
  },
});
