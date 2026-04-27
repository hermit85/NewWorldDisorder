// ─────────────────────────────────────────────────────────────
// LeagueProofCard — quiet "the league exists" tile.
//
// Rendered below the hero in SCOPE_EMPTY: today / weekend / sezon
// hasn't started yet, but the trail's all-time leaderboard is
// non-empty. The card surfaces the trail record + the rider's
// own all-time rank so a fresh-day Tablica doesn't read as a dead
// product. Visually subdued — must not compete with the hero.
//
// Tappable when `onPress` is supplied — the natural shortcut is to
// switch the scope to REKORDY so the rider can inspect the all-time
// board they just saw a glimpse of. Affordance is a small chevron
// + "ZOBACZ REKORDY →" so it never reads as a second primary CTA.
// ─────────────────────────────────────────────────────────────

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { LeagueProofCard as ProofCardData } from '@/features/leaderboard/state';

export interface LeagueProofCardProps {
  data: ProofCardData;
  onPress?: () => void;
}

export function LeagueProofCard({ data, onPress }: LeagueProofCardProps) {
  const showSeparateUserRow = !data.leaderIsUser && data.userRank != null && data.userTime != null;

  const Body = (
    <>
      <Text style={styles.label}>{data.label}</Text>

      <View style={styles.row}>
        <Text style={styles.diamond}>◆</Text>
        <Text style={styles.rider} numberOfLines={1}>
          {data.leaderName}
        </Text>
        {data.leaderIsUser ? <Text style={styles.tyTag}>TY</Text> : null}
        <Text style={styles.time}>{data.leaderTime}</Text>
      </View>

      <Text style={styles.trailingNote}>
        {data.leaderIsUser ? 'REKORD TRASY #1 — broń korony.' : 'Rekord do pobicia.'}
      </Text>

      {showSeparateUserRow ? (
        <View style={[styles.row, styles.userRow]}>
          <Text style={styles.dot}>·</Text>
          <Text style={styles.userLabel}>TY</Text>
          <Text style={styles.userRank}>#{data.userRank}</Text>
          <Text style={styles.userTime}>{data.userTime}</Text>
        </View>
      ) : null}

      {onPress ? (
        <Text style={styles.viewAll}>ZOBACZ REKORDY →</Text>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {Body}
      </Pressable>
    );
  }
  return <View style={styles.card}>{Body}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  cardPressed: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
  },
  viewAll: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
    marginTop: 2,
  },
  label: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  userRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 2,
  },
  diamond: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.gold,
    width: 14,
    textAlign: 'center',
  },
  dot: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textTertiary,
    width: 14,
    textAlign: 'center',
  },
  rider: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tyTag: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentInk,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 1.5,
  },
  time: {
    fontFamily: fonts.racing,
    fontSize: 16,
    fontWeight: '800',
    color: colors.gold,
    letterSpacing: 0.4,
  },
  trailingNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  userLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accentInk,
    backgroundColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    letterSpacing: 1.5,
  },
  userRank: {
    flex: 1,
    fontFamily: fonts.racing,
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent,
  },
  userTime: {
    fontFamily: fonts.racing,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
});
