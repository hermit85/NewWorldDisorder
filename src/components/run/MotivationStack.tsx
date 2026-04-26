// ═══════════════════════════════════════════════════════════
// MotivationStack — shared gaming-context card stack for
// both Pioneer recording (app/run/recording.tsx) and Rider
// active-run (app/run/active.tsx) screens.
//
// Variants:
//   'pioneer' — draft trail, no prior PB, empty leaderboard.
//               Renders only the neutral "PIERWSZY ZJAZD" card.
//   'rider'   — finalized trail with leaderboard. Renders
//               delta-to-PB + optional rival-above or KRÓL
//               TRASY card depending on user's rank.
//
// Pure presentation component. Callers compute all data (PB,
// rival entry, gap ms, rank) and pass as props. Component
// makes no network calls and owns no state.
//
// Style tokens: canonical Acid palette via @/theme/colors. Emerald
// = accent (state.armed/verified), amber = warn (state.pending).
// No separate HUD theme.
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { spacing, radii } from '@/theme/spacing';
import { formatDelta } from '@/lib/format';

export type RivalAbove = {
  username: string;
  rank: number;   // rival's leaderboard position (currentPosition)
  gapMs: number;  // positive — user's bestDuration − rival's bestDuration
} | null;

export interface MotivationStackProps {
  elapsedMs: number;
  /** User's personal best on this trail in ms. Null on draft trails or
   *  first Rider run. */
  userPbMs: number | null;
  /** Entry at user's rank − 1 on the leaderboard, or null if user is
   *  unranked / is #1 / rival is unknown. */
  rivalAbove: RivalAbove;
  /** User's current leaderboard position on this trail. Null if not on
   *  leaderboard yet. Used to detect #1 (KRÓL TRASY) state. */
  userRank: number | null;
  /** 'pioneer' short-circuits to the neutral first-run card; 'rider'
   *  exercises the full delta / rival / king state machine. */
  variant: 'pioneer' | 'rider';
}

export function MotivationStack({
  elapsedMs,
  userPbMs,
  rivalAbove,
  userRank,
  variant,
}: MotivationStackProps) {
  // Pioneer variant: always the neutral "first descent" card. Delta /
  // rival / king are all undefined on a draft trail by construction.
  if (variant === 'pioneer') {
    return (
      <View style={styles.stack}>
        <View style={styles.firstRunCard}>
          <View>
            <Text style={styles.firstRunKicker}>✦ PIERWSZY ZJAZD</Text>
            <Text style={styles.sub}>Twój czas zostanie zapisany</Text>
          </View>
        </View>
      </View>
    );
  }

  // Rider variant: delta-to-PB always (or neutral fallback on first
  // Rider run), plus an optional king-of-the-hill or rival-above card.
  const isKing = userRank === 1;
  const hasPb = userPbMs !== null;

  return (
    <View style={styles.stack}>
      {hasPb ? (() => {
        const deltaMs = elapsedMs - userPbMs!;
        const ahead = deltaMs < 0;
        const accent = ahead ? colors.accent : colors.warn;
        return (
          <View
            style={[
              styles.deltaCard,
              ahead ? styles.deltaCardAhead : styles.deltaCardBehind,
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: accent }]}>
                {ahead ? '✦ PROWADZISZ' : '● TRACISZ DO PB'}
              </Text>
              <Text style={styles.sub}>vs. Twoje PB</Text>
            </View>
            <Text style={[styles.deltaValue, { color: accent }]}>
              {formatDelta(deltaMs)}
            </Text>
          </View>
        );
      })() : (
        <View style={styles.firstRunCard}>
          <View>
            <Text style={styles.firstRunKicker}>✦ PIERWSZY ZJAZD NA TEJ TRASIE</Text>
            <Text style={styles.sub}>Ten czas zostanie Twoim rekordem</Text>
          </View>
        </View>
      )}

      {isKing ? (
        <View style={[styles.deltaCard, styles.deltaCardAhead]}>
          <View>
            <Text style={[styles.kicker, { color: colors.accent }]}>
              ✦ KRÓL TRASY
            </Text>
            <Text style={styles.sub}>Trzymaj pozycję</Text>
          </View>
        </View>
      ) : rivalAbove ? (
        <View style={styles.rivalCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rivalKicker}>
              ● RYWAL · #{rivalAbove.rank}
            </Text>
            <Text style={styles.rivalName} numberOfLines={1}>
              {rivalAbove.username}
            </Text>
          </View>
          <Text style={styles.rivalDelta}>
            -{(rivalAbove.gapMs / 1000).toFixed(2)}s
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
    alignSelf: 'stretch',
  },
  deltaCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: spacing.lg,
  },
  deltaCardAhead: {
    backgroundColor: 'rgba(0, 255, 140, 0.08)',
    borderColor: colors.accent,
  },
  deltaCardBehind: {
    backgroundColor: 'rgba(255, 217, 61, 0.08)',
    borderColor: colors.warn,
  },
  kicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 2,
  },
  sub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  deltaValue: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 32,
    fontVariant: ['tabular-nums'] as any,
  },
  firstRunCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(232, 255, 240, 0.08)',
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginHorizontal: spacing.lg,
  },
  firstRunKicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 2,
    color: colors.accent,
  },
  rivalCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 217, 61, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: colors.warn,
    borderRadius: radii.sm,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: spacing.lg,
  },
  rivalKicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.warn,
  },
  rivalName: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: 4,
  },
  rivalDelta: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 22,
    color: colors.warn,
    fontVariant: ['tabular-nums'] as any,
  },
});
