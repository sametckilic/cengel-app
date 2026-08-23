import type { PropsWithChildren } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { palette, typography } from '@/constants/design';

type SectionLabelProps = PropsWithChildren<{
  style?: StyleProp<TextStyle>;
}>;

export function SectionLabel({ children, style }: SectionLabelProps) {
  return <Text style={[styles.label, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  label: {
    ...typography.gridHint,
    color: palette.outline,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
