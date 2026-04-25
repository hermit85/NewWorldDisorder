// ─────────────────────────────────────────────────────────────
// SectionHead — small tag-style label with optional count (ui.jsx)
//
// Anatomy:
//   [icon]  LABEL TEXT          [count]    [action?]
//
// Used as a section header inside scrollable content (Trasy w
// parku · 6 / W okolicy · 3 spoty / Tablica · dziś).
// ─────────────────────────────────────────────────────────────
import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { IconGlyph, type IconName } from './IconGlyph';

export interface SectionHeadProps {
  icon?: IconName;
  label: string;
  count?: string | number | null;
  /** Trailing action node — e.g. a "PEŁNY ↗" link button. */
  action?: ReactNode;
  style?: ViewStyle;
}

export function SectionHead({
  icon,
  label,
  count,
  action,
  style,
}: SectionHeadProps) {
  return (
    <View style={[styles.container, style]}>
      {icon ? <IconGlyph name={icon} size={13} variant="accent" /> : null}
      <Text style={styles.label} numberOfLines={1}>
        {label.toUpperCase()}
      </Text>
      {count != null ? (
        <Text style={styles.count}>{String(count)}</Text>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  label: {
    ...typography.label,
    flex: 1,
    color: colors.textPrimary,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    fontSize: 10.5,
    letterSpacing: 1.89, // 0.18em @ 10.5
  },
  count: {
    ...typography.micro,
    color: colors.textTertiary,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 0.8,
  },
});
