// ═══════════════════════════════════════════════════════════
// TwojStanding — Home cockpit hero card. The rider's identity
// + standing in a single composed surface: big rider tag (left),
// rank position pill (right), 3 mini-stats row, XP progress bar
// + "DO LVL N · X/Y XP" caption.
//
// First impression on Home — this is what the rider sees in the
// first second of opening the app. Must read as cockpit / pit
// lane, not feature card.
// ═══════════════════════════════════════════════════════════

import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface TwojStandingProps {
  riderTag: string;
  rankLabel: string;
  rankColor?: string;
  level: number;
  /** Three mini-stats as label/value pairs. Render in a row. */
  stats: Array<{ label: string; value: string | number; accent?: boolean }>;
  /** Current XP within the level (0 → levelMaxXp). */
  currentLevelXp: number;
  levelMaxXp: number;
}

export function TwojStanding({
  riderTag,
  rankLabel,
  rankColor,
  level,
  stats,
  currentLevelXp,
  levelMaxXp,
}: TwojStandingProps) {
  const xpProgress = levelMaxXp > 0 ? Math.min(currentLevelXp / levelMaxXp, 1) : 0;
  const xpRemaining = Math.max(levelMaxXp - currentLevelXp, 0);

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>TWOJE STANOWISKO</Text>

      <View style={styles.identityRow}>
        <Text style={styles.tag} numberOfLines={1} adjustsFontSizeToFit>
          @{riderTag}
        </Text>
        <View style={[styles.rankBadge, rankColor ? { borderColor: rankColor } : null]}>
          <Text style={[styles.rankBadgeLabel, rankColor ? { color: rankColor } : null]}>
            {rankLabel.toUpperCase()}
          </Text>
          <Text style={styles.rankBadgeLevel}>LVL {level}</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        {stats.map((s, i) => (
          <View
            key={s.label}
            style={[
              styles.statBox,
              i < stats.length - 1 && styles.statBoxDivider,
            ]}
          >
            <Text style={styles.statLabel}>{s.label.toUpperCase()}</Text>
            <Text
              style={[
                styles.statValue,
                s.accent ? { color: colors.accent } : null,
              ]}
            >
              {s.value}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.xpBlock}>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${xpProgress * 100}%` }]} />
        </View>
        <Text style={styles.xpCaption}>
          DO LVL {level + 1} · {currentLevelXp}/{levelMaxXp} XP
          {xpRemaining > 0 ? ` · BRAKUJE ${xpRemaining}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.borderHot,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    gap: 16,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 6,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  tag: {
    flex: 1,
    fontFamily: fonts.racing,
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 1,
    lineHeight: 34,
  },
  rankBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 2,
    minWidth: 92,
  },
  rankBadgeLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  rankBadgeLevel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.6,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    paddingVertical: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statBoxDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  statLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.6,
  },
  statValue: {
    fontFamily: fonts.racing,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  xpBlock: {
    gap: 6,
  },
  xpTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  xpCaption: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.6,
  },
});
