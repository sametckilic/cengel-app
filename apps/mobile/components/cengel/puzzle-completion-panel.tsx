import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, ReduceMotion } from 'react-native-reanimated';

import { fonts, palette, spacing, typography } from '@/constants/design';

type PuzzleCompletionPanelProps = {
  onDismiss: () => void;
  onHomePress: () => void;
  revealedWordCount: number;
  wordCount: number;
};

export function PuzzleCompletionPanel({
  onDismiss,
  onHomePress,
  revealedWordCount,
  wordCount,
}: PuzzleCompletionPanelProps) {
  return (
    <Animated.View
      accessibilityViewIsModal
      entering={FadeIn.duration(160).reduceMotion(ReduceMotion.System)}
      onAccessibilityEscape={onDismiss}
      style={styles.overlay}>
      <Animated.View
        entering={FadeInUp.duration(220).reduceMotion(ReduceMotion.System)}
        style={styles.panel}>
        <Text style={styles.eyebrow}>Bulmaca tamamlandı</Text>
        <Text accessibilityRole="header" style={styles.title}>
          Tebrikler!
        </Text>
        <Text style={styles.description}>
          {wordCount} kelimelik bulmacayı tamamladın.
          {revealedWordCount > 0 ? ` ${revealedWordCount} ipucu kullandın.` : ''}
        </Text>

        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            onPress={onHomePress}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
            ]}>
            <Text style={styles.primaryButtonLabel}>Ana Sayfa</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
            ]}>
            <Text style={styles.secondaryButtonLabel}>Bulmacaya Bak</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 26, 0.42)',
    justifyContent: 'center',
    padding: spacing.page,
    zIndex: 20,
  },
  panel: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.ink,
    borderWidth: 1,
    maxWidth: 400,
    padding: spacing.page,
    width: '100%',
  },
  eyebrow: {
    ...typography.caption,
    color: palette.secondary,
    fontFamily: fonts.interBold,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: {
    ...typography.headlineLg,
    color: palette.ink,
    marginTop: spacing.tight,
    textAlign: 'center',
  },
  description: {
    ...typography.bodyClue,
    color: palette.onSurfaceVariant,
    marginTop: spacing.tight,
    textAlign: 'center',
  },
  actions: {
    gap: spacing.tight,
    marginTop: spacing.page,
    width: '100%',
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: palette.ink,
    borderColor: palette.ink,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.page,
  },
  primaryButtonPressed: {
    backgroundColor: palette.onSurfaceVariant,
  },
  primaryButtonLabel: {
    color: palette.paper,
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: palette.paper,
    borderColor: palette.ink,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.page,
  },
  secondaryButtonPressed: {
    backgroundColor: palette.cellLocked,
  },
  secondaryButtonLabel: {
    color: palette.ink,
    fontFamily: fonts.interSemiBold,
    fontSize: 14,
    lineHeight: 20,
    textTransform: 'uppercase',
  },
});
