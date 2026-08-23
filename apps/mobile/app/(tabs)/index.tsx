import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';

import { EditorialHeader } from '@/components/cengel/editorial-header';
import {
  EditorialIcon,
  type EditorialIconName,
} from '@/components/cengel/editorial-icon';
import { SectionLabel } from '@/components/cengel/section-label';
import { fonts, layout, palette, spacing, typography } from '@/constants/design';
import { NEWSPAPER_PROTOTYPE } from '@/data/newspaper-prototype';
import {
  getDifficultyLabel,
  getPuzzleCategoryLabel,
  getPuzzleHref,
  getPuzzleSizeLabel,
} from '@/data/puzzle-catalog';
import { usePuzzleProgressCatalog } from '@/hooks/use-puzzle-progress-catalog';
import { usePuzzleCatalog } from '@/providers/puzzle-catalog-provider';
import type { PuzzleProgressSummary } from '@/services/puzzle-progress';
import type { PuzzleDefinition } from '@/types/puzzle';

type PackItem = {
  category: string;
  title: string;
  icon: EditorialIconName;
  href?: '/packs/edebiyat';
};

const PACKS: readonly PackItem[] = [
  {
    category: 'edebiyat',
    title: 'Edebiyat',
    icon: 'menu-book',
    href: '/packs/edebiyat',
  },
  { category: 'tarih', title: 'Tarih', icon: 'history-edu' },
  { category: 'sinema', title: 'Sinema', icon: 'movie' },
  { category: 'bilim', title: 'Bilim', icon: 'science' },
];

function getPackCountLabel(
  puzzles: readonly PuzzleDefinition[],
  category: string,
): string {
  const count = puzzles.filter(
    (puzzle) => puzzle.categories.length === 1 && puzzle.categories[0] === category,
  ).length;

  return count > 0 ? `${count} Bulmaca` : 'Yakında';
}

const WEEK_DAYS = [
  { label: 'Pzt', state: 'done' },
  { label: 'Sal', state: 'done' },
  { label: 'Çar', state: 'today' },
  { label: 'Per', state: 'future' },
  { label: 'Cum', state: 'future' },
  { label: 'Cmt', state: 'future' },
  { label: 'Paz', state: 'future' },
] as const;

const TEXTURE_LINES = Array.from({ length: 30 }, (_, index) => index * 20);

function PuzzleTexture() {
  return (
    <View style={styles.texture}>
      {TEXTURE_LINES.map((offset) => (
        <View key={'vertical-' + offset} style={[styles.textureVertical, { left: offset }]} />
      ))}
      {TEXTURE_LINES.map((offset) => (
        <View key={'horizontal-' + offset} style={[styles.textureHorizontal, { top: offset }]} />
      ))}
    </View>
  );
}

function PlayRing({ progress }: { progress: PuzzleProgressSummary }) {
  return (
    <View
      accessibilityLabel={`Bulmaca yüzde ${progress.completionPercentage} tamamlandı`}
      style={styles.progressRing}>
      <Svg height={48} style={styles.progressSvg} viewBox="0 0 36 36" width={48}>
        <Circle
          cx={18}
          cy={18}
          fill="none"
          r={15.9155}
          stroke={palette.gridLine}
          strokeWidth={2}
        />
        <Circle
          cx={18}
          cy={18}
          fill="none"
          r={15.9155}
          strokeDasharray={`${progress.completionPercentage} ${100 - progress.completionPercentage}`}
          strokeLinecap="round"
          transform="rotate(-90 18 18)"
          stroke={palette.primary}
          strokeWidth={2}
        />
      </Svg>
      <EditorialIcon
        name={progress.status === 'completed' ? 'check' : 'play-arrow'}
        size={14}
      />
    </View>
  );
}

function PackCard({ count, item }: { count: string; item: PackItem }) {
  const router = useRouter();
  const contents = (
    <>
      <View style={styles.packIconBox}>
        <EditorialIcon name={item.icon} />
      </View>
      <View>
        <Text style={styles.packTitle}>{item.title}</Text>
        <Text style={styles.packCount}>{count}</Text>
      </View>
    </>
  );

  if (item.href) {
    return (
      <Pressable
        accessibilityLabel={[item.title, count].join(', ')}
        onPress={() => router.push(item.href!)}
        style={({ pressed }) => [styles.packCard, pressed && styles.pressedSurface]}>
        {contents}
      </Pressable>
    );
  }

  return <View style={styles.packCard}>{contents}</View>;
}

function WeeklyStreak() {
  return (
    <View style={styles.streakCard}>
      {WEEK_DAYS.map((day) => {
        const isDone = day.state === 'done';
        const isToday = day.state === 'today';

        return (
          <View key={day.label} style={[styles.day, day.state === 'future' && styles.futureDay]}>
            <Text style={[styles.dayLabel, isToday && styles.todayLabel]}>{day.label}</Text>
            <View
              style={[
                styles.dayStatus,
                isDone && styles.dayStatusDone,
                isToday && styles.dayStatusToday,
              ]}>
              {isDone ? (
                <EditorialIcon color={palette.paper} name="check" size={14} />
              ) : isToday ? (
                <View style={styles.todayDot} />
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { getDailyPuzzle, getLatestDailyPuzzle, getPuzzleById, puzzles } =
    usePuzzleCatalog();
  const dailyPuzzle = useMemo(
    () =>
      getDailyPuzzle(new Date()) ??
      getLatestDailyPuzzle() ??
      NEWSPAPER_PROTOTYPE,
    [getDailyPuzzle, getLatestDailyPuzzle],
  );
  const featuredPuzzle =
    getPuzzleById('karma-zor-001') ?? puzzles[1] ?? dailyPuzzle;
  const { getSummary } = usePuzzleProgressCatalog();
  const dailyProgress = getSummary(dailyPuzzle.id);
  const featuredProgress = getSummary(featuredPuzzle.id);
  const dailyActionLabel =
    dailyProgress.status === 'completed'
      ? 'Tamamlandı'
      : dailyProgress.status === 'in-progress'
        ? 'Devam Et'
        : 'Oyna';

  return (
    <SafeAreaView edges={['left', 'right']} style={styles.screen}>
      <EditorialHeader
        compactBrand
        leftIcon="menu"
        leftLabel="Menü"
        rightIcon="account-circle"
        rightLabel="Profil"
        title="ÇENGEL"
        variant="brand"
      />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <View style={styles.pageTitleSection}>
            <Text style={styles.pageTitle}>Ne çözebilirim?</Text>
          </View>

          <View style={styles.todayCard}>
            <PuzzleTexture />
            <View style={styles.todayCardContent}>
              <SectionLabel>Günün Bulmacası</SectionLabel>
              <Text style={styles.todayTitle}>
                {getPuzzleSizeLabel(dailyPuzzle)} · {dailyPuzzle.words.length} Kelime
              </Text>
              <View style={styles.difficultyRow}>
                <EditorialIcon color={palette.onSurfaceVariant} name="speed" size={14} />
                <Text style={styles.difficultyText}>
                  {getDifficultyLabel(dailyPuzzle.difficulty)} ·{' '}
                  {getPuzzleCategoryLabel(dailyPuzzle)}
                </Text>
              </View>
              {dailyProgress.status !== 'not-started' ? (
                <Text style={styles.progressText}>
                  {dailyProgress.solvedWordCount}/{dailyProgress.totalWordCount} kelime tamamlandı
                </Text>
              ) : null}
              <Pressable
                accessibilityLabel={`${dailyPuzzle.title}, ${getPuzzleSizeLabel(dailyPuzzle)}, oyna`}
                onPress={() => router.push(getPuzzleHref(dailyPuzzle.id))}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
                <Text style={styles.primaryButtonText}>{dailyActionLabel}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.paddedSection}>
            <SectionLabel>Öne Çıkan Bulmaca</SectionLabel>
            <Pressable
              accessibilityLabel={`${featuredPuzzle.title}, ${getDifficultyLabel(featuredPuzzle.difficulty)}, aç`}
              onPress={() => router.push(getPuzzleHref(featuredPuzzle.id))}
              style={({ pressed }) => [styles.continueCard, pressed && styles.pressedSurface]}>
              <View>
                <Text style={styles.continueTitle}>{featuredPuzzle.title}</Text>
                <Text style={styles.continueMeta}>
                  {getPuzzleSizeLabel(featuredPuzzle)} ·{' '}
                  {getDifficultyLabel(featuredPuzzle.difficulty)}
                  {featuredProgress.status !== 'not-started'
                    ? ` · ${featuredProgress.solvedWordCount}/${featuredProgress.totalWordCount} kelime`
                    : ''}
                </Text>
              </View>
              <PlayRing progress={featuredProgress} />
            </Pressable>
          </View>

          <View style={styles.packSection}>
            <View style={styles.sectionLabelInset}>
              <SectionLabel>Tematik Paketler</SectionLabel>
            </View>
            <ScrollView
              contentContainerStyle={styles.packScroller}
              horizontal
              showsHorizontalScrollIndicator={false}>
              {PACKS.map((item) => (
                <PackCard
                  count={getPackCountLabel(puzzles, item.category)}
                  item={item}
                  key={item.title}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.paddedSection}>
            <SectionLabel>Haftalık Seri</SectionLabel>
            <WeeklyStreak />
          </View>

          <View style={styles.premiumSection}>
            <View style={styles.premiumStar}>
              <EditorialIcon color={palette.onPrimary} name="star" size={128} />
            </View>
            <Text style={styles.premiumTitle}>Premium Üyelik</Text>
            <Text style={styles.premiumDescription}>
              Tüm bulmaca arşivine sınırsız erişim ve reklamsız deneyim.
            </Text>
            <View style={styles.premiumList}>
              {['Sınırsız Arşiv', 'Reklamsız Deneyim', 'Özel Tematik Paketler'].map((item) => (
                <View key={item} style={styles.premiumListItem}>
                  <EditorialIcon color={palette.onPrimary} name="done" size={14} />
                  <Text style={styles.premiumListText}>{item}</Text>
                </View>
              ))}
            </View>
            <View accessibilityLabel="Bilgi al" style={styles.infoButton}>
              <Text style={styles.infoButtonText}>Bilgi Al</Text>
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
  scrollContainer: {
    paddingBottom: 96,
    paddingTop: spacing.section,
  },
  content: {
    alignSelf: 'center',
    gap: spacing.section,
    maxWidth: layout.maxContent,
    width: '100%',
  },
  pageTitleSection: {
    paddingHorizontal: spacing.page,
  },
  pageTitle: {
    ...typography.headlineLg,
    color: palette.ink,
  },
  todayCard: {
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    marginHorizontal: spacing.page,
    overflow: 'hidden',
    padding: spacing.page,
  },
  texture: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  textureVertical: {
    backgroundColor: 'rgba(26, 26, 26, 0.03)',
    bottom: 0,
    position: 'absolute',
    top: 0,
    width: 2,
  },
  textureHorizontal: {
    backgroundColor: 'rgba(26, 26, 26, 0.03)',
    height: 2,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  todayCardContent: {
    alignItems: 'center',
    gap: 16,
  },
  todayTitle: {
    ...typography.headlineMd,
    color: palette.ink,
    textAlign: 'center',
  },
  difficultyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.tight,
  },
  difficultyText: {
    ...typography.bodyClue,
    color: palette.onSurfaceVariant,
  },
  progressText: {
    ...typography.caption,
    color: palette.secondary,
    fontFamily: fonts.interSemiBold,
  },
  primaryButton: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.ink,
    borderColor: palette.ink,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 16,
    minHeight: 50,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  primaryPressed: {
    backgroundColor: palette.onSurfaceVariant,
  },
  primaryButtonText: {
    ...typography.gridInput,
    color: palette.paper,
    textTransform: 'uppercase',
  },
  paddedSection: {
    gap: spacing.tight,
    paddingHorizontal: spacing.page,
  },
  continueCard: {
    alignItems: 'center',
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 82,
    padding: 16,
  },
  pressedSurface: {
    backgroundColor: palette.surfaceLow,
  },
  continueTitle: {
    ...typography.gridInput,
    color: palette.ink,
  },
  continueMeta: {
    ...typography.bodyClue,
    color: palette.onSurfaceVariant,
  },
  progressRing: {
    alignItems: 'center',
    borderColor: palette.primary,
    borderRadius: 24,
    borderWidth: 2,
    height: 48,
    justifyContent: 'center',
    position: 'relative',
    width: 48,
  },
  progressSvg: {
    ...StyleSheet.absoluteFillObject,
    position: 'absolute',
  },
  packSection: {
    gap: spacing.tight,
  },
  sectionLabelInset: {
    paddingHorizontal: spacing.page,
  },
  packScroller: {
    gap: 16,
    paddingBottom: 16,
    paddingLeft: 0,
    paddingRight: spacing.page,
  },
  packCard: {
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    gap: 12,
    minHeight: 116,
    padding: 16,
    width: 160,
  },
  packIconBox: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.gridLine,
    borderRadius: 4,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  packTitle: {
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
    fontSize: 16,
    lineHeight: 20,
  },
  packCount: {
    ...typography.caption,
    color: palette.onSurfaceVariant,
    marginTop: 4,
  },
  streakCard: {
    alignItems: 'center',
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 88,
    padding: 16,
  },
  day: {
    alignItems: 'center',
    gap: spacing.tight,
  },
  futureDay: {
    opacity: 0.4,
  },
  dayLabel: {
    ...typography.caption,
    color: palette.onSurfaceVariant,
  },
  todayLabel: {
    color: palette.ink,
    fontFamily: fonts.interBold,
  },
  dayStatus: {
    alignItems: 'center',
    borderColor: palette.gridLine,
    borderRadius: 16,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dayStatusDone: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  dayStatusToday: {
    backgroundColor: palette.paper,
    borderColor: palette.primary,
  },
  todayDot: {
    backgroundColor: palette.primary,
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  premiumSection: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderColor: palette.ink,
    borderWidth: 1,
    marginHorizontal: spacing.page,
    overflow: 'hidden',
    padding: spacing.page,
    position: 'relative',
  },
  premiumStar: {
    opacity: 0.05,
    pointerEvents: 'none',
    position: 'absolute',
    right: -16,
    top: -16,
  },
  premiumTitle: {
    ...typography.headlineMd,
    color: palette.paper,
    marginBottom: 8,
    textAlign: 'center',
  },
  premiumDescription: {
    ...typography.bodyClue,
    color: palette.paper,
    marginBottom: spacing.page,
    maxWidth: 250,
    opacity: 0.9,
    textAlign: 'center',
  },
  premiumList: {
    gap: spacing.tight,
    marginBottom: spacing.page,
    maxWidth: 200,
    width: '100%',
  },
  premiumListItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.tight,
  },
  premiumListText: {
    color: palette.paper,
    fontFamily: fonts.interMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  infoButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: 'transparent',
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    width: '100%',
  },
  infoButtonText: {
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
    fontSize: 16,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
});
