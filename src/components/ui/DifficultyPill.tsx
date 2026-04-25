// ─────────────────────────────────────────────────────────────
// DifficultyPill — Bike Park Hub list pill
//
// Maps Trail.{difficulty, type} to the canonical 4-pill set the
// design uses on every list / map / leaderboard surface:
//
//   EASY  green  beginner / easy difficulty
//   FLOW  blue   flow type (preferred over difficulty)
//   HARD  red    medium / hard difficulty
//   PRO   black  expert / pro difficulty
//
// Source: design-system/NWD Design System.html § 09 Track lines
// (difficulty taxonomy) + design-system/Bike Park Hub.html
// (.trailDiffPill rules).
// ─────────────────────────────────────────────────────────────
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export type DifficultyTone = 'green' | 'blue' | 'red' | 'black';

export interface DifficultyPillProps {
  tone: DifficultyTone;
  /** Override default label (EASY/FLOW/HARD/PRO). */
  label?: string;
  style?: ViewStyle;
}

const TONE_PRESETS: Record<DifficultyTone, { color: string; bg: string; border: string; defaultLabel: string }> = {
  green: {
    color: colors.diffGreen,
    bg: 'rgba(60, 203, 127, 0.08)',
    border: 'rgba(60, 203, 127, 0.40)',
    defaultLabel: 'EASY',
  },
  blue: {
    color: colors.diffBlue,
    bg: 'rgba(59, 156, 255, 0.08)',
    border: 'rgba(59, 156, 255, 0.40)',
    defaultLabel: 'FLOW',
  },
  red: {
    color: colors.diffRed,
    bg: 'rgba(255, 71, 87, 0.08)',
    border: 'rgba(255, 71, 87, 0.40)',
    defaultLabel: 'HARD',
  },
  black: {
    color: colors.textPrimary,
    bg: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.20)',
    defaultLabel: 'PRO',
  },
};

/**
 * Resolve the pill tone from Trail.difficulty + type.
 * Flow type wins over difficulty since it's the more specific
 * descriptor for terrain feel.
 */
export function resolveDifficultyTone(difficulty?: string | null, type?: string | null): DifficultyTone {
  const t = (type ?? '').toLowerCase();
  const d = (difficulty ?? '').toLowerCase();
  if (t === 'flow') return 'blue';
  if (d === 'easy') return 'green';
  if (d === 'expert' || d === 'pro') return 'black';
  if (d === 'hard' || d === 'medium' || d === 'tech') return 'red';
  return 'red';
}

export function DifficultyPill({ tone, label, style }: DifficultyPillProps) {
  const preset = TONE_PRESETS[tone];
  return (
    <View style={[styles.pill, { backgroundColor: preset.bg, borderColor: preset.border }, style]}>
      <Text style={[styles.label, { color: preset.color }]}>
        {label ?? preset.defaultLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 3,
    // Square corners — Bike Park Hub uses straight edges on
    // difficulty pills (rounded reserved for status / chip pills).
    borderRadius: 0,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.micro,
    fontSize: 8,
    letterSpacing: 1.28, // 0.16em @ 8px
    fontWeight: '800',
  },
});
