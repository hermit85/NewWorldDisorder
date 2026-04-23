// ═══════════════════════════════════════════════════════════
// SectionHeader — consistent block-level separator for list/detail
// screens. Pairs a short uppercase label with an optional meta/count
// or action slot on the right so a reader can scan the page by
// section titles alone. Intentionally small (single line, 11px label)
// because the *content* below is what earns the visual weight, not
// the header itself.
// ═══════════════════════════════════════════════════════════

import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

export interface SectionHeaderProps {
  label: string;
  /** Single-character glyph rendered before the label (●, ▲, ◆, ♛ …).
   *  Anchors the section visually without icon-library dependency. */
  glyph?: string;
  /** Right-slot: counter ("3/7") or short meta. Ignored when `action`
   *  is provided. */
  meta?: string;
  /** Right-slot: a pressable action ("ZOBACZ WSZYSTKIE"). Takes priority
   *  over meta. */
  action?: { label: string; onPress: () => void };
  /** Colour of the glyph — defaults to tertiary text so it reads as
   *  chrome not content. Use accent colours for "live" sections. */
  glyphColor?: string;
  /** Extra top margin — handy when a header directly follows another
   *  section body without a divider between. */
  spacingTop?: 'none' | 'md' | 'lg' | 'xl';
  /** Rendered when the parent wants an inline child (e.g. a pill badge)
   *  between label and meta. */
  children?: ReactNode;
}

const TOP_SPACING: Record<NonNullable<SectionHeaderProps['spacingTop']>, number> = {
  none: 0,
  md: spacing.md,
  lg: spacing.lg,
  xl: spacing.xl,
};

export function SectionHeader({
  label,
  glyph,
  meta,
  action,
  glyphColor,
  spacingTop = 'lg',
  children,
}: SectionHeaderProps) {
  return (
    <View style={[styles.root, { marginTop: TOP_SPACING[spacingTop] }]}>
      <View style={styles.left}>
        {glyph ? (
          <Text style={[styles.glyph, glyphColor ? { color: glyphColor } : undefined]}>
            {glyph}
          </Text>
        ) : null}
        <Text style={styles.label} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
        {children}
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          hitSlop={8}
        >
          <Text style={styles.action}>{action.label.toUpperCase()}</Text>
        </Pressable>
      ) : meta ? (
        <Text style={styles.meta}>{meta}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
  },
  glyph: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    color: colors.textTertiary,
  },
  label: {
    ...typography.label,
    color: colors.textSecondary,
    fontSize: 11,
    letterSpacing: 2.5,
    flexShrink: 1,
  },
  meta: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  action: {
    ...typography.labelSmall,
    color: colors.accent,
    fontSize: 10,
    letterSpacing: 2,
  },
});
