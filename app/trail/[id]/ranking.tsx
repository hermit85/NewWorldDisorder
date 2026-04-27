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

import { useState } from 'react';
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
import type { LeaderboardEntry, Difficulty, PeriodType } from '@/data/types';
import {
  MOCK_LEADERBOARD_USER_1,
  MOCK_LEADERBOARD_USER_5,
  MOCK_LEADERBOARD_USER_14,
  MOCK_PIONEER_USER_ID_FOR_OTHERS,
  MOCK_PIONEER_USER_ID_FOR_VARIANT_1,
  MOCK_BREADCRUMB_SPOT_NAME,
  MOCK_BREADCRUMB_TRAIL_NAME,
  MOCK_BREADCRUMB_DIFFICULTY,
} from '@/dev/tablicaMock';

const SCOPE_TABS: Array<{ key: PeriodType; label: string }> = [
  { key: 'day', label: 'DZIŚ' },
  { key: 'weekend', label: 'WEEKEND' },
  { key: 'all_time', label: 'SEZON' },
];

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
  const { id: trailId, dev: devParam } = useLocalSearchParams<{
    id: string;
    dev?: string;
  }>();
  const { profile } = useAuthContext();

  const [scope, setScope] = useState<PeriodType>('all_time');

  const { trail } = useTrail(trailId ?? null);
  const { spot } = useSpot(trail?.spotId ?? null);
  const { entries: realEntries } = useLeaderboard(trailId ?? '', scope, profile?.id);

  // __DEV__ walk-test variants — ?dev=mock5 / mock1 / mock14
  const isDevMock5 = __DEV__ && devParam === 'mock5';
  const isDevMock1 = __DEV__ && devParam === 'mock1';
  const isDevMock14 = __DEV__ && devParam === 'mock14';
  const isAnyDevMock = isDevMock5 || isDevMock1 || isDevMock14;

  const entries: LeaderboardEntry[] = isDevMock1
    ? MOCK_LEADERBOARD_USER_1
    : isDevMock14
      ? MOCK_LEADERBOARD_USER_14
      : isDevMock5
        ? MOCK_LEADERBOARD_USER_5
        : realEntries;

  const pioneerUserId = isDevMock1
    ? MOCK_PIONEER_USER_ID_FOR_VARIANT_1
    : isAnyDevMock
      ? MOCK_PIONEER_USER_ID_FOR_OTHERS
      : (trail?.pioneerUserId ?? null);

  const top8 = entries.slice(0, 8);
  const leaderTimeMs = top8[0]?.bestDurationMs ?? 0;

  // Edge case — current user is outside top 8. Render the standard
  // top 8, then a "— TWÓJ CZAS —" separator + SelfRow with the
  // rider's actual position. SELF + position never disappears.
  const myEntry = entries.find((e) => e.isCurrentUser);
  const myInTop8 = top8.some((e) => e.isCurrentUser);
  const showSeparator = !!myEntry && !myInTop8;

  const trailName = isAnyDevMock
    ? MOCK_BREADCRUMB_TRAIL_NAME
    : (trail?.name ?? 'Trasa');
  const spotName = isAnyDevMock
    ? MOCK_BREADCRUMB_SPOT_NAME
    : (spot?.name ?? '');
  const difficulty: Difficulty | undefined = isAnyDevMock
    ? MOCK_BREADCRUMB_DIFFICULTY
    : trail?.difficulty;
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

        {/* Scope tabs — DZIŚ / WEEKEND / SEZON */}
        <View style={styles.scopeTabsRow}>
          {SCOPE_TABS.map((tab) => {
            const active = scope === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => setScope(tab.key)}
                style={[styles.scopeTab, active && styles.scopeTabActive]}
              >
                <Text style={[styles.scopeTabText, active && styles.scopeTabTextActive]}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Ranking list */}
        <View style={styles.listContainer}>
          {top8.length > 0 ? (
            <>
              {top8.map((entry) => renderRow(entry, leaderTimeMs, pioneerUserId))}
              {showSeparator && myEntry ? (
                <>
                  <View style={styles.separator}>
                    <Text style={styles.separatorText}>— TWÓJ CZAS —</Text>
                  </View>
                  {renderRow(myEntry, leaderTimeMs, pioneerUserId)}
                </>
              ) : null}
            </>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>BRAK WYNIKÓW</Text>
              <Text style={styles.emptyHint}>Bądź pierwszy.</Text>
            </View>
          )}
        </View>

        {/* Self placeholder when rider has no time — Q1 spec edge case */}
        {!myEntry && profile ? (
          <View style={[styles.listContainer, styles.selfPlaceholderWrap]}>
            <View style={styles.separator}>
              <Text style={styles.separatorText}>— TWÓJ CZAS —</Text>
            </View>
            <View style={styles.selfPlaceholderBody}>
              <Text style={styles.selfPlaceholderCopy}>
                Brak czasu. Jedź żeby się pojawić tutaj.
              </Text>
              <Pressable
                style={styles.selfPlaceholderCta}
                onPress={() =>
                  router.push({
                    pathname: '/run/active',
                    params: {
                      trailId: trailId ?? '',
                      trailName: trail?.name ?? '',
                      intent: 'ranked',
                    },
                  })
                }
              >
                <Text style={styles.selfPlaceholderCtaText}>JEDŹ →</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
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
  scopeTabsRow: {
    flexDirection: 'row',
    marginHorizontal: 24,
    marginTop: 18,
    gap: 6,
  },
  scopeTab: {
    flex: 1,
    height: 32,
    borderRadius: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeTabActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  scopeTabText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(242,244,243,0.55)',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  scopeTabTextActive: {
    color: colors.accentInk,
  },
  listContainer: {
    marginTop: 14,
    marginHorizontal: 24,
    backgroundColor: '#0E1517',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  selfPlaceholderWrap: {
    marginTop: 14,
  },
  selfPlaceholderBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  selfPlaceholderCopy: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(242,244,243,0.55)',
  },
  selfPlaceholderCta: {
    paddingHorizontal: 16,
    height: 28,
    borderRadius: 2,
    backgroundColor: 'rgba(0,255,135,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(0,255,135,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selfPlaceholderCtaText: {
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.5,
  },
  separator: {
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.06)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  separatorText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(242,244,243,0.32)',
    letterSpacing: 2.5,
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
