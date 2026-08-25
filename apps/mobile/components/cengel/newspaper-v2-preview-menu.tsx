import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditorialHeader } from '@/components/cengel/editorial-header';
import { EditorialIcon } from '@/components/cengel/editorial-icon';
import { SectionLabel } from '@/components/cengel/section-label';
import { fonts, layout, palette, spacing, typography } from '@/constants/design';
import { NEWSPAPER_V2_PREVIEW_PUZZLES } from '@/data/newspaper-v2-preview';
import {
  getDifficultyLabel,
  getPuzzleCategoryLabel,
  getPuzzleSizeLabel,
} from '@/data/puzzle-catalog';
import type { NewspaperPuzzleDefinition } from '@cengel/puzzle-core/puzzle';

function PreviewPuzzleRow({ puzzle }: { puzzle: NewspaperPuzzleDefinition }) {
  const router = useRouter();
  const themedWordCount = puzzle.words.filter(({ category }) =>
    puzzle.categories.includes(category),
  ).length;

  return (
    <Pressable
      accessibilityLabel={`${puzzle.title}, ${getPuzzleSizeLabel(puzzle)}, önizlemeyi aç`}
      onPress={() =>
        router.push({
          pathname: '/newspaper-preview',
          params: { id: puzzle.id },
        })
      }
      style={({ pressed }) => [styles.previewRow, pressed && styles.previewRowPressed]}>
      <View style={styles.previewCopy}>
        <Text style={styles.previewTitle}>{puzzle.title}</Text>
        <Text style={styles.previewMeta}>
          {getPuzzleSizeLabel(puzzle)} · {getDifficultyLabel(puzzle.difficulty)} ·{' '}
          {puzzle.words.length} kelime
        </Text>
        <Text numberOfLines={2} style={styles.previewCategories}>
          {getPuzzleCategoryLabel(puzzle)} · {themedWordCount}/{puzzle.words.length}{' '}
          ağırlıklı kelime
        </Text>
      </View>
      <EditorialIcon color={palette.secondary} name="arrow-forward" size={24} />
    </Pressable>
  );
}

export function NewspaperV2PreviewMenu() {
  const router = useRouter();

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <Stack.Screen options={{ headerShown: false, title: 'V2 Bulmaca UAT' }} />
      <EditorialHeader
        leftIcon="arrow-back"
        leftLabel="Geri"
        onLeftPress={() => router.back()}
        subtitle="Üretim akışından bağımsız önizleme"
        title="V2 Bulmaca UAT"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.intro}>
            <SectionLabel>GÖRSEL KONTROL</SectionLabel>
            <Text style={styles.introTitle}>Beş farklı düzeni karşılaştır</Text>
            <Text style={styles.introDescription}>
              İlk satır dağılımını, yatay-dikey dengeyi ve ipucu metinlerinin
              okunabilirliğini kontrol et. Bu bulmacalar henüz günlük üretime bağlı değil.
            </Text>
          </View>

          <View style={styles.previewList}>
            {NEWSPAPER_V2_PREVIEW_PUZZLES.map((puzzle) => (
              <PreviewPuzzleRow key={puzzle.id} puzzle={puzzle} />
            ))}
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
  scrollContent: {
    paddingBottom: spacing.section,
    paddingTop: spacing.section,
  },
  content: {
    alignSelf: 'center',
    maxWidth: layout.maxContent,
    paddingHorizontal: spacing.page,
    width: '100%',
  },
  intro: {
    borderBottomColor: palette.gridLine,
    borderBottomWidth: 1,
    paddingBottom: spacing.page,
  },
  introTitle: {
    ...typography.headlineMd,
    color: palette.ink,
    marginTop: spacing.tight,
  },
  introDescription: {
    ...typography.bodyClue,
    color: palette.onSurfaceVariant,
    marginTop: spacing.tight,
  },
  previewList: {
    marginTop: spacing.tight,
  },
  previewRow: {
    alignItems: 'center',
    borderBottomColor: palette.gridLine,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 16,
    minHeight: 112,
    paddingVertical: 16,
  },
  previewRowPressed: {
    backgroundColor: palette.surfaceLow,
  },
  previewCopy: {
    flex: 1,
  },
  previewTitle: {
    ...typography.bodyClue,
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
  },
  previewMeta: {
    ...typography.caption,
    color: palette.secondary,
    marginTop: spacing.cell,
  },
  previewCategories: {
    ...typography.caption,
    color: palette.outline,
    marginTop: spacing.cell,
  },
});
