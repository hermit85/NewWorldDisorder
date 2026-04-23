// ═══════════════════════════════════════════════════════════
// Divider — horizontal separator with intentional spacing.
//
// Three strengths, matching the "rule of three separation levels":
//   soft  — hairline with tight padding, used inside a section to
//           split related rows (stats row → activity list).
//   line  — default 1px hairline with generous padding, used between
//           subsections of the same page.
//   strong — hairline on a filled bar, used at major functional
//           boundaries (stats → settings, feed → admin).
//
// Renderers never mix their own spacing with a Divider — the divider
// *is* the spacing. That keeps screens pixel-consistent.
// ═══════════════════════════════════════════════════════════

import { StyleSheet, View } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

export interface DividerProps {
  variant?: 'soft' | 'line' | 'strong';
}

export function Divider({ variant = 'line' }: DividerProps) {
  return <View style={styles[variant]} />;
}

const styles = StyleSheet.create({
  soft: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
    opacity: 0.6,
  },
  line: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  strong: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: spacing.xl,
  },
});
