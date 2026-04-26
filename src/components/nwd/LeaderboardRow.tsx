// ─────────────────────────────────────────────────────────────
// LeaderboardRow — canonical row (per components.md § LeaderboardRow)
//
// Layout grid: 48px (pos) | 1fr (rider+sub) | auto (time) | auto (delta)
// Row states:
//   default → e3 (row + borderMid)
//   self    → e4 (rowHot + borderHot + glowSoft) + accent name tint
//   podium  → position color = gold/silver/bronze (top 3 only)
//
// Time and delta always tabular-nums. Delta tone:
//   negative ("−1.42")  → accent (faster vs reference)
//   positive ("+0.38")  → invalid (slower)
//   neutral / null      → muted
// ─────────────────────────────────────────────────────────────
import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export interface LeaderboardRowProps {
  position: number;
  /** String → rendered as styled rider name; ReactNode → consumer owns the row content (badges, tags). */
  rider: string | ReactNode;
  /** Sub-meta line — "Bike Park · Trail" / "+1.4s do lidera". */
  sub?: string | null;
  /** Pre-formatted time, e.g. "02:14.83". */
  time: string;
  /** Optional delta — time ("−1.42" / "+0.38") or position ("↑3" / "↓2"). */
  delta?: string | null;
  /** Marks the current user's row. */
  self?: boolean;
  /** Optional avatar / icon left-of-position. Renders inside the 48px slot. */
  leading?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  style?: ViewStyle;
}

const PODIUM: Record<number, string> = {
  1: colors.gold,
  2: colors.silver,
  3: colors.bronze,
};

function deltaTone(delta: string): 'accent' | 'danger' | 'muted' {
  const t = delta.trim();
  // Time delta: "−1.42" faster (good), "+0.38" slower (bad).
  // Position delta: "↑3" gained places (good), "↓2" lost places (bad).
  if (t.startsWith('−') || t.startsWith('-') || t.startsWith('↑')) return 'accent';
  if (t.startsWith('+') || t.startsWith('↓')) return 'danger';
  return 'muted';
}

const TONE_COLOR: Record<'accent' | 'danger' | 'muted', string> = {
  accent: colors.accent,
  danger: colors.danger,
  muted: colors.textTertiary,
};

export function LeaderboardRow({
  position,
  rider,
  sub,
  time,
  delta,
  self = false,
  leading,
  onPress,
  onLongPress,
  delayLongPress,
  style,
}: LeaderboardRowProps) {
  const positionColor = PODIUM[position] ?? colors.textPrimary;
  const isPressable = Boolean(onPress || onLongPress);
  const Container = isPressable ? Pressable : View;
  const containerProps = isPressable
    ? {
        onPress,
        onLongPress,
        delayLongPress,
        style: ({ pressed }: { pressed: boolean }) => [
          styles.row,
          self && styles.rowSelf,
          pressed && styles.rowPressed,
          style,
        ],
      }
    : { style: [styles.row, self && styles.rowSelf, style] };

  return (
    <Container {...(containerProps as any)}>
      <View style={styles.posSlot}>
        {leading}
        <Text style={[styles.pos, { color: positionColor }]} numberOfLines={1}>
          {String(position).padStart(2, '0')}
        </Text>
      </View>

      <View style={styles.main}>
        {typeof rider === 'string' ? (
          <Text
            style={[styles.rider, self && styles.riderSelf]}
            numberOfLines={1}
          >
            {rider}
          </Text>
        ) : (
          rider
        )}
        {sub ? (
          <Text style={styles.sub} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>

      <Text style={styles.time} numberOfLines={1}>
        {time}
      </Text>

      {delta ? (
        <Text
          style={[styles.delta, { color: TONE_COLOR[deltaTone(delta)] }]}
          numberOfLines={1}
        >
          {delta}
        </Text>
      ) : (
        <Text style={[styles.delta, { color: colors.textTertiary }]}>—</Text>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.row,
    borderWidth: 1,
    borderColor: colors.borderMid,
    marginBottom: 6,
  },
  rowSelf: {
    borderColor: colors.borderHot,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.20,
    shadowRadius: 16,
    elevation: 4,
  },
  rowPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  posSlot: {
    width: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pos: {
    ...typography.lead,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 22,
    lineHeight: 22,
    fontWeight: '700',
    letterSpacing: -0.22, // -0.01em @ 22
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  main: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rider: {
    ...typography.lead,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 16,
    lineHeight: 18,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  riderSelf: {
    color: colors.accent,
    fontWeight: '700',
  },
  sub: {
    ...typography.body,
    fontSize: 11,
    color: colors.textSecondary,
    fontFamily: 'Inter_500Medium',
  },
  time: {
    ...typography.lead,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 18,
    lineHeight: 18,
    color: colors.textPrimary,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  delta: {
    ...typography.delta,
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    lineHeight: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    minWidth: 44,
    textAlign: 'right',
  },
});
