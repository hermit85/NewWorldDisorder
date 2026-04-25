// ─────────────────────────────────────────────────────────────
// RaceTime — canonical hero number (per components.md § RaceTime)
//
// Sizes:
//   hero    56/800 -0.01em   — final time / result hero
//   split   26/700           — between gates / intermediate splits
//   widget  28/700           — list cards / leaderboard rows
//
// Always tabular-nums (§ 13.1 non-negotiable). Optional `dimMs`
// dims the centiseconds so the seconds read as the focal element.
// Optional `delta` renders mono +18px on right — accent for
// negative ("−1.42 PB", faster), invalid for positive.
// ─────────────────────────────────────────────────────────────
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export type RaceTimeSize = 'hero' | 'split' | 'widget';

export interface RaceTimeProps {
  /** Format `MM:SS.ms` or `M:SS.ms` (e.g. "02:14.83"). */
  value: string;
  size?: RaceTimeSize;
  /** Dim the centiseconds (default true for hero). */
  dimMs?: boolean;
  /** Optional delta string — "−1.42 PB" / "+0.38". */
  delta?: string | null;
  /** Override delta direction tint (default: dash="−" → accent, "+" → danger). */
  deltaTone?: 'auto' | 'accent' | 'danger' | 'muted';
  style?: ViewStyle;
}

const SIZE_MAP: Record<RaceTimeSize, { fs: number; ls: number }> = {
  // letterSpacing computed as fontSize × tracking_em (RN absolute px).
  hero:   { fs: 56, ls: -0.56 },  // -0.01em @ 56
  split:  { fs: 26, ls: -0.13 },  // -0.005em @ 26
  widget: { fs: 28, ls: -0.14 },
};

function splitTime(value: string): { main: string; ms: string | null } {
  // Split at the last "." — anything after is centiseconds.
  const dot = value.lastIndexOf('.');
  if (dot < 0) return { main: value, ms: null };
  return { main: value.slice(0, dot), ms: value.slice(dot) };
}

function autoTone(delta: string): 'accent' | 'danger' | 'muted' {
  const trimmed = delta.trim();
  // Proper minus (U+2212) AND ASCII hyphen both count.
  if (trimmed.startsWith('−') || trimmed.startsWith('-')) return 'accent';
  if (trimmed.startsWith('+')) return 'danger';
  return 'muted';
}

const TONE_COLOR: Record<'accent' | 'danger' | 'muted', string> = {
  accent: colors.accent,
  danger: colors.danger,
  muted: colors.textSecondary,
};

export function RaceTime({
  value,
  size = 'widget',
  dimMs = true,
  delta = null,
  deltaTone = 'auto',
  style,
}: RaceTimeProps) {
  const dim = SIZE_MAP[size];
  const { main, ms } = dimMs ? splitTime(value) : { main: value, ms: null };
  const tone = delta
    ? deltaTone === 'auto' ? autoTone(delta) : deltaTone
    : 'muted';
  const deltaSize = size === 'hero' ? 18 : size === 'split' ? 13 : 14;

  return (
    <View style={[styles.container, style]}>
      <Text
        style={[
          styles.timeBase,
          { fontSize: dim.fs, letterSpacing: dim.ls, lineHeight: dim.fs },
        ]}
      >
        <Text style={styles.timeMain}>{main}</Text>
        {ms ? <Text style={styles.timeMs}>{ms}</Text> : null}
      </Text>

      {delta ? (
        <Text
          style={[
            styles.delta,
            { fontSize: deltaSize, color: TONE_COLOR[tone] },
          ]}
          numberOfLines={1}
        >
          {delta}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  timeBase: {
    fontFamily: 'Rajdhani_700Bold',
    color: colors.textPrimary,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timeMain: {
    color: colors.textPrimary,
  },
  timeMs: {
    color: colors.textSecondary,
  },
  delta: {
    ...typography.delta,
    fontFamily: 'Inter_700Bold',
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0,
  },
});
