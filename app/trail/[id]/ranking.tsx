// ═══════════════════════════════════════════════════════════
// /trail/[id]/ranking — RankingScreen (Tablica Phase 1)
//
// Drilldown sub-screen reachable from Tablica Landing trail rows
// AND (future) Spot/Trail detail "Tablica" buttons. Reads
// fetch_scoped_leaderboard via useLeaderboard hook.
//
// Row variants per spec:
//   #1 GOLD     52px · gold tint bg · gold bar 3px · "REKORD"
//   #2 SILVER   46px · silver bar 3px · "−Δ do lidera"
//   #3 BRONZE   46px · bronze bar 3px · "−Δ do lidera"
//   #4-N STANDARD 46px · no bar · dimmed position · "−Δ"
//   SELF        accent tint bg · accent bar 3px · all green
//
// Self-override rule: when current user is in top-3, render the
// SELF style — wins over podium. Pioneer ⚡ icon stays regardless.
//
// Commit 4 ships layout + 4 row variants + self override.
// Commit 5 adds scope tabs + out-of-top-8 separator + BottomBand.
// ═══════════════════════════════════════════════════════════

import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { IconGlyph } from '@/components/nwd';
import { RiderAvatar } from '@/components/RiderAvatar';
import { useAuthContext } from '@/hooks/AuthContext';
import { useTrail, useSpot, useLeaderboard } from '@/hooks/useBackend';
import { formatTimeMs, formatDelta } from '@/utils/time';
import type { LeaderboardEntry, Difficulty } from '@/data/types';

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  easy: '#22C55E',
  medium: '#3B82F6',
  hard: '#FF4757',
  expert: '#0E1517',
  pro: '#0E1517',
};

const isBlackDiff = (d: Difficulty) => d === 'expert' || d === 'pro';

interface RowProps {
  entry: LeaderboardEntry;
  leaderTimeMs: number;
  pioneerUserId: string | null;
}

function GoldRow({ entry, pioneerUserId }: RowProps) {
  const isPioneer = entry.userId === pioneerUserId;
  return (
    <View style={[rowStyles.base, rowStyles.goldBg]}>
      <View style={[rowStyles.bar, rowStyles.goldBar]} />
      <View style={rowStyles.posCol}>
        <Text style={[rowStyles.posBig, { color: colors.gold }]}>1</Text>
      </View>
      <View style={[rowStyles.avatarRing, { borderColor: colors.gold }]}>
        <RiderAvatar
          avatarUrl={entry.avatarUrl}
          username={entry.username}
          size={28}
        />
      </View>
      <View style={rowStyles.identityCol}>
        <View style={rowStyles.nickRow}>
          <Text style={rowStyles.nick} numberOfLines={1}>
            {entry.username}
          </Text>
          {isPioneer ? (
            <IconGlyph name="lock" size={11} color={colors.gold} />
          ) : null}
        </View>
        <Text style={[rowStyles.metaLabel, { color: 'rgba(255,210,63,0.6)' }]}>REKORD</Text>
      </View>
      <Text style={[rowStyles.time, { color: colors.gold }]}>{formatTimeMs(entry.bestDurationMs)}</Text>
    </View>
  );
}

function MedalRow({
  entry,
  leaderTimeMs,
  pioneerUserId,
  position,
}: RowProps & { position: 2 | 3 }) {
  const tone = position === 2 ? colors.silver : colors.bronze;
  const barStyle = position === 2 ? rowStyles.silverBar : rowStyles.bronzeBar;
  const deltaMs = entry.bestDurationMs - leaderTimeMs;
  const isPioneer = entry.userId === pioneerUserId;
  return (
    <View style={[rowStyles.base, rowStyles.medalBg]}>
      <View style={[rowStyles.bar, barStyle]} />
      <View style={rowStyles.posCol}>
        <Text style={[rowStyles.posMid, { color: tone }]}>{position}</Text>
      </View>
      <View style={[rowStyles.avatarRing, { borderColor: tone }]}>
        <RiderAvatar
          avatarUrl={entry.avatarUrl}
          username={entry.username}
          size={26}
        />
      </View>
      <View style={rowStyles.identityCol}>
        <View style={rowStyles.nickRow}>
          <Text style={rowStyles.nick} numberOfLines={1}>
            {entry.username}
          </Text>
          {isPioneer ? <IconGlyph name="lock" size={11} color={tone} /> : null}
        </View>
        <Text style={rowStyles.deltaSmall}>{formatDelta(deltaMs, true)}</Text>
      </View>
      <Text style={[rowStyles.time, { color: colors.textPrimary }]}>{formatTimeMs(entry.bestDurationMs)}</Text>
    </View>
  );
}

function StandardRow({ entry, leaderTimeMs, pioneerUserId }: RowProps) {
  const deltaMs = entry.bestDurationMs - leaderTimeMs;
  const isPioneer = entry.userId === pioneerUserId;
  return (
    <View style={rowStyles.base}>
      <View style={rowStyles.posCol}>
        <Text style={rowStyles.posDimmed}>{entry.currentPosition}</Text>
      </View>
      <View style={[rowStyles.avatarRing, { borderColor: 'rgba(255,255,255,0.12)' }]}>
        <RiderAvatar
          avatarUrl={entry.avatarUrl}
          username={entry.username}
          size={26}
        />
      </View>
      <View style={rowStyles.identityCol}>
        <View style={rowStyles.nickRow}>
          <Text style={rowStyles.nick} numberOfLines={1}>
            {entry.username}
          </Text>
          {isPioneer ? <IconGlyph name="lock" size={11} color={colors.textSecondary} /> : null}
        </View>
        <Text style={rowStyles.deltaShort}>{formatDelta(deltaMs)}</Text>
      </View>
      <Text style={[rowStyles.time, { color: colors.textPrimary }]}>{formatTimeMs(entry.bestDurationMs)}</Text>
    </View>
  );
}

function SelfRow({ entry, leaderTimeMs, pioneerUserId }: RowProps) {
  const deltaMs = entry.bestDurationMs - leaderTimeMs;
  const isPioneer = entry.userId === pioneerUserId;
  return (
    <View style={[rowStyles.base, rowStyles.selfBg]}>
      <View style={[rowStyles.bar, rowStyles.selfBar]} />
      <View style={rowStyles.posCol}>
        <Text style={[rowStyles.posMid, { color: colors.accent }]}>{entry.currentPosition}</Text>
      </View>
      <View style={[rowStyles.avatarRing, { borderColor: colors.accent }]}>
        <RiderAvatar
          avatarUrl={entry.avatarUrl}
          username={entry.username}
          size={26}
        />
      </View>
      <View style={rowStyles.identityCol}>
        <View style={rowStyles.nickRow}>
          <Text style={[rowStyles.nick, { color: colors.accent }]} numberOfLines={1}>
            {entry.username}
          </Text>
          <View style={rowStyles.selfTyPill}>
            <Text style={rowStyles.selfTyText}>TY</Text>
          </View>
          {isPioneer ? <IconGlyph name="lock" size={11} color={colors.accent} /> : null}
        </View>
        <Text style={[rowStyles.deltaShort, { color: 'rgba(0,255,135,0.6)' }]}>
          {entry.currentPosition === 1 ? 'REKORD' : formatDelta(deltaMs, true)}
        </Text>
      </View>
      <Text style={[rowStyles.time, { color: colors.accent }]}>{formatTimeMs(entry.bestDurationMs)}</Text>
    </View>
  );
}

function renderRow(entry: LeaderboardEntry, leaderTimeMs: number, pioneerUserId: string | null) {
  // SELF ZAWSZE WYGRYWA per spec — overrides podium tint.
  if (entry.isCurrentUser) {
    return <SelfRow key={entry.userId} entry={entry} leaderTimeMs={leaderTimeMs} pioneerUserId={pioneerUserId} />;
  }
  if (entry.currentPosition === 1) {
    return <GoldRow key={entry.userId} entry={entry} leaderTimeMs={leaderTimeMs} pioneerUserId={pioneerUserId} />;
  }
  if (entry.currentPosition === 2 || entry.currentPosition === 3) {
    return (
      <MedalRow
        key={entry.userId}
        entry={entry}
        leaderTimeMs={leaderTimeMs}
        pioneerUserId={pioneerUserId}
        position={entry.currentPosition}
      />
    );
  }
  return <StandardRow key={entry.userId} entry={entry} leaderTimeMs={leaderTimeMs} pioneerUserId={pioneerUserId} />;
}

export default function RankingScreen() {
  const router = useRouter();
  const { id: trailId } = useLocalSearchParams<{ id: string }>();
  const { profile } = useAuthContext();

  const { trail } = useTrail(trailId ?? null);
  const { spot } = useSpot(trail?.spotId ?? null);
  const { entries } = useLeaderboard(trailId ?? '', 'all_time', profile?.id);

  const top8 = entries.slice(0, 8);
  const leaderTimeMs = top8[0]?.bestDurationMs ?? 0;

  const trailName = trail?.name ?? 'Trasa';
  const spotName = spot?.name ?? '';
  const difficulty = trail?.difficulty;
  const diffColor = difficulty ? DIFFICULTY_COLOR[difficulty] : colors.textSecondary;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top section */}
        <View style={styles.top}>
          <Pressable
            style={styles.backBtn}
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/leaderboard'))}
            accessibilityRole="button"
            accessibilityLabel="Wróć"
          >
            <IconGlyph name="arrow-left" size={14} color={colors.textPrimary} />
          </Pressable>

          <View style={styles.breadcrumb}>
            {spotName ? (
              <>
                <Text style={styles.breadSpot}>{spotName.toUpperCase()}</Text>
                <Text style={styles.breadDot}>·</Text>
              </>
            ) : null}
            <Text style={styles.breadTrail}>{trailName.toUpperCase()}</Text>
            {difficulty ? (
              <View
                style={[
                  styles.breadDiff,
                  { backgroundColor: diffColor },
                  isBlackDiff(difficulty) && styles.breadDiffBlack,
                ]}
              />
            ) : null}
          </View>

          <Text style={styles.headline}>RANKING</Text>
          <Text style={styles.sub}>
            Tylko zweryfikowane · {entries.length} {entries.length === 1 ? 'rider' : 'riderów'}
          </Text>
        </View>

        {/* Ranking list — commit 5 will add scope tabs above + edge separator + BottomBand below */}
        <View style={styles.listContainer}>
          {top8.length > 0 ? (
            top8.map((entry) => renderRow(entry, leaderTimeMs, trail?.pioneerUserId ?? null))
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>BRAK WYNIKÓW</Text>
              <Text style={styles.emptyHint}>Bądź pierwszy.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 80 },
  top: { paddingHorizontal: 24, paddingTop: 16, gap: 8 },
  backBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.panel,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breadSpot: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(242,244,243,0.32)',
    letterSpacing: 1.6,
  },
  breadDot: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: 'rgba(242,244,243,0.32)',
  },
  breadTrail: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
  },
  breadDiff: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  breadDiffBlack: {
    borderWidth: 1,
    borderColor: '#F2F4F3',
  },
  headline: {
    fontFamily: fonts.racing,
    fontSize: 44,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 46,
    marginTop: 8,
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  listContainer: {
    marginTop: 18,
    marginHorizontal: 24,
    backgroundColor: '#0E1517',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  empty: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 4,
  },
  emptyHint: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
});

const rowStyles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    gap: 12,
    position: 'relative',
  },
  goldBg: {
    backgroundColor: 'rgba(255,210,63,0.04)',
    minHeight: 52,
    paddingVertical: 10,
  },
  medalBg: {
    backgroundColor: 'transparent',
  },
  selfBg: {
    backgroundColor: 'rgba(0,255,135,0.10)',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  goldBar: { backgroundColor: colors.gold },
  silverBar: { backgroundColor: colors.silver },
  bronzeBar: { backgroundColor: colors.bronze },
  selfBar: { backgroundColor: colors.accent },

  posCol: {
    width: 28,
    alignItems: 'center',
  },
  posBig: {
    fontFamily: fonts.racing,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 24,
    letterSpacing: -0.5,
  },
  posMid: {
    fontFamily: fonts.racing,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  posDimmed: {
    fontFamily: fonts.racing,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
    color: 'rgba(242,244,243,0.4)',
  },

  avatarRing: {
    borderWidth: 1.5,
    borderRadius: 999,
    overflow: 'hidden',
  },
  identityCol: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nick: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  deltaSmall: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(242,244,243,0.4)',
    letterSpacing: 1.2,
  },
  deltaShort: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(242,244,243,0.32)',
    letterSpacing: 1.2,
  },
  time: {
    fontFamily: fonts.racing,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  selfTyPill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  selfTyText: {
    fontFamily: fonts.mono,
    fontSize: 8,
    fontWeight: '800',
    color: colors.accentInk,
    letterSpacing: 1,
  },
});
