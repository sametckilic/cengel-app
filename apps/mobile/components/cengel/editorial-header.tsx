import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditorialIcon, type EditorialIconName } from '@/components/cengel/editorial-icon';
import { layout, palette, spacing, typography } from '@/constants/design';

type EditorialHeaderProps = {
  title: string;
  subtitle?: string;
  variant?: 'brand' | 'page';
  compactBrand?: boolean;
  leftIcon?: EditorialIconName;
  rightIcon?: EditorialIconName;
  leftLabel?: string;
  rightLabel?: string;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  bleedLeftAction?: boolean;
  fullWidth?: boolean;
  floating?: boolean;
  translucent?: boolean;
};

type HeaderActionProps = {
  icon?: EditorialIconName;
  label?: string;
  onPress?: () => void;
};

function HeaderAction({ icon, label, onPress }: HeaderActionProps) {
  if (!icon) {
    return <View style={styles.action} />;
  }

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={!onPress}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}>
      <EditorialIcon name={icon} />
    </Pressable>
  );
}

export function EditorialHeader({
  title,
  subtitle,
  variant = 'page',
  compactBrand = false,
  leftIcon,
  rightIcon,
  leftLabel,
  rightLabel,
  onLeftPress,
  onRightPress,
  bleedLeftAction = false,
  fullWidth = false,
  floating = false,
  translucent = false,
}: EditorialHeaderProps) {
  const isBrand = variant === 'brand';

  return (
    <SafeAreaView
      edges={['top']}
      style={[
        styles.safeArea,
        translucent && styles.translucentSafeArea,
        floating && styles.floatingSafeArea,
      ]}>
      <View
        style={[
          styles.inner,
          !isBrand && styles.pageInner,
          { maxWidth: fullWidth ? undefined : isBrand ? layout.maxContent : layout.maxDetail },
        ]}>
        <View style={bleedLeftAction && styles.bleedLeftAction}>
          <HeaderAction icon={leftIcon} label={leftLabel} onPress={onLeftPress} />
        </View>
        <View style={styles.titleGroup}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              isBrand
                ? compactBrand
                  ? styles.compactBrandTitle
                  : styles.brandTitle
                : typography.headlineMd,
            ]}>
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={styles.subtitle}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <HeaderAction icon={rightIcon} label={rightLabel} onPress={onRightPress} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: palette.paper,
    borderBottomColor: palette.gridLine,
    borderBottomWidth: 1,
    zIndex: 20,
  },
  floatingSafeArea: {
    elevation: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  inner: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.page,
    width: '100%',
  },
  pageInner: {
    height: 72,
  },
  action: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  actionPressed: {
    backgroundColor: palette.cellLocked,
    borderRadius: 20,
  },
  title: {
    color: palette.primary,
    textAlign: 'center',
  },
  titleGroup: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  subtitle: {
    ...typography.caption,
    color: palette.onSurfaceVariant,
    marginTop: 1,
    textAlign: 'center',
  },
  translucentSafeArea: {
    backgroundColor: 'rgba(249, 247, 242, 0.9)',
  },
  brandTitle: {
    ...typography.headlineLg,
    letterSpacing: 3.2,
    textTransform: 'uppercase',
  },
  compactBrandTitle: {
    color: palette.primary,
    fontFamily: typography.bodyClue.fontFamily,
    fontSize: 16,
    letterSpacing: 1.6,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  bleedLeftAction: {
    marginLeft: -8,
  },
});
