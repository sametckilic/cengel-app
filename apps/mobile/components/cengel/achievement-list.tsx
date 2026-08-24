import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { AchievementApiItem } from '@cengel/contracts/achievement-api';

import { EditorialIcon } from '@/components/cengel/editorial-icon';
import { SectionLabel } from '@/components/cengel/section-label';
import { fonts, palette, spacing, typography } from '@/constants/design';

type AchievementListProps = {
  error: string | null;
  items: readonly AchievementApiItem[] | null;
  loading: boolean;
  onRetry: () => void;
};

function formatEarnedAt(value: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(value));
}

export function AchievementList({ error, items, loading, onRetry }: AchievementListProps) {
  const earnedCount = items?.filter(({ earnedAt }) => earnedAt !== null).length ?? 0;

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <SectionLabel>Başarımlar</SectionLabel>
          <Text style={styles.heading}>Bulmaca Kariyeri</Text>
        </View>
        {items ? (
          <Text accessibilityLabel={`${earnedCount} / ${items.length} başarım`} style={styles.count}>
            {earnedCount}/{items.length}
          </Text>
        ) : null}
      </View>

      {loading && !items ? (
        <View style={styles.loadingState}>
          <ActivityIndicator color={palette.ink} />
          <Text style={styles.loadingText}>Başarımlar yükleniyor…</Text>
        </View>
      ) : null}

      {error && !items ? (
        <View style={styles.errorState}>
          <EditorialIcon color={palette.error} name="cloud-off" size={22} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onRetry}
            style={({ pressed }) => [styles.retryButton, pressed && styles.buttonPressed]}>
            <Text style={styles.retryText}>Tekrar Dene</Text>
          </Pressable>
        </View>
      ) : null}

      {items?.map((achievement) => {
        const earned = achievement.earnedAt !== null;

        return (
          <View
            accessibilityLabel={`${achievement.title}, ${earned ? 'kazanıldı' : 'kilitli'}`}
            key={achievement.id}
            style={[styles.card, !earned && styles.cardLocked]}>
            <View style={[styles.icon, earned && styles.iconEarned]}>
              <EditorialIcon
                color={earned ? palette.onPrimary : palette.mutedInk}
                name={earned ? 'emoji-events' : 'lock'}
                size={22}
              />
            </View>
            <View style={styles.cardCopy}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{achievement.title}</Text>
                <Text style={[styles.state, earned && styles.stateEarned]}>
                  {earned ? 'KAZANILDI' : 'KİLİTLİ'}
                </Text>
              </View>
              <Text style={styles.description}>{achievement.description}</Text>
              {achievement.earnedAt ? (
                <Text style={styles.meta}>
                  {formatEarnedAt(achievement.earnedAt)} ·{' '}
                  {achievement.verification === 'verified' ? 'Doğrulanmış' : 'Rahat mod'}
                </Text>
              ) : null}
            </View>
          </View>
        );
      })}

      {loading && items ? <ActivityIndicator color={palette.ink} size="small" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12, marginTop: spacing.section },
  headingRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: { ...typography.headlineMd, color: palette.ink, marginTop: 4 },
  count: {
    ...typography.caption,
    color: palette.ink,
    fontFamily: fonts.interBold,
    paddingBottom: 4,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 72,
    padding: 16,
  },
  loadingText: { ...typography.bodyClue, color: palette.onSurfaceVariant },
  errorState: {
    alignItems: 'flex-start',
    backgroundColor: palette.errorContainer,
    gap: 10,
    padding: 16,
  },
  errorText: { ...typography.bodyClue, color: palette.onErrorContainer },
  retryButton: {
    borderColor: palette.onErrorContainer,
    borderWidth: 1,
    minHeight: 40,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  retryText: {
    ...typography.caption,
    color: palette.onErrorContainer,
    fontFamily: fonts.interBold,
  },
  buttonPressed: { opacity: 0.72 },
  card: {
    alignItems: 'flex-start',
    backgroundColor: palette.surfaceLowest,
    borderColor: palette.gridLine,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },
  cardLocked: { backgroundColor: palette.surfaceLow },
  icon: {
    alignItems: 'center',
    borderColor: palette.outlineVariant,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconEarned: { backgroundColor: palette.primary, borderColor: palette.primary },
  cardCopy: { flex: 1, gap: 4 },
  titleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  title: {
    ...typography.bodyClue,
    color: palette.ink,
    flex: 1,
    fontFamily: fonts.interBold,
  },
  state: {
    ...typography.caption,
    color: palette.mutedInk,
    fontFamily: fonts.interBold,
    fontSize: 10,
  },
  stateEarned: { color: palette.secondary },
  description: { ...typography.bodyClue, color: palette.onSurfaceVariant },
  meta: { ...typography.caption, color: palette.outline, marginTop: 4 },
});
