// ─────────────────────────────────────────────────────────────
// /(tabs)/leaderboard — Tablica race-day status screen.
//
// Replaces the older "list of my trails by spot" landing. The new
// Tablica is a per-trail competitive view that mirrors Home's
// state-machine discipline:
//
//   1. Header        — TABLICA · {spotName} · {trailName}
//   2. Scope toggle  — DZIŚ / WEEKEND / SEZON / ALL-TIME
//   3. Trail picker  — only when spot has 2+ verified trails
//   4. Hero          — LeaderboardHero, position-aware
//   5. Top 3 podium  — gold/silver/bronze racing board
//   6. Sticky TY row — when user is outside the top 3
//   7. Tail rows     — remaining standings
//   8. CTA           — secondary, contextual to mission
//
// Default trail = the trail Home is promoting. heroBeat wins; we
// fall back to the first verified trail. Once the rider taps a
// chip in the picker, that selection sticks for the session.
// ─────────────────────────────────────────────────────────────

import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot } from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  useHeroBeat,
  useLeaderboard,
  usePrimarySpot,
  useTrails,
} from '@/hooks/useBackend';
import { deriveLeaderboardState } from '@/features/leaderboard/state';
import { resolveLeaderboardCtaRoute } from '@/features/leaderboard/route';
import { LeaderboardHero } from '@/components/leaderboard/LeaderboardHero';
import {
  ScopeToggle,
  type ScopeKey,
} from '@/components/leaderboard/ScopeToggle';
import { PodiumBlock } from '@/components/leaderboard/PodiumBlock';
import { LeagueProofCard } from '@/components/leaderboard/LeagueProofCard';
import {
  buildWalkInput,
  isWalkState,
  type WalkState,
} from '@/dev/leaderboardWalk';
import type { CalibrationStatus, PeriodType, Trail } from '@/data/types';

const TAB_BAR_CLEARANCE = 64;

const VERIFIED_CALIBRATIONS: ReadonlySet<CalibrationStatus> = new Set([
  'live_fresh',
  'live_confirmed',
  'stable',
  'verified',
  'locked',
]);

// SEZON isn't yet a distinct period in the API. Until the backend
// exposes a season-scoped query we route SEZON to the all-time
// leaderboard so the chip is interactive but truthful (it shows
// season-long results, just without per-season filtering yet).
// TODO(api): wire a real `season_*` PeriodType when sezony land.
function scopeToPeriod(scope: ScopeKey): PeriodType {
  switch (scope) {
    case 'today':
      return 'day';
    case 'weekend':
      return 'weekend';
    case 'season':
    case 'all_time':
      return 'all_time';
  }
}

export default function TablicaScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, isAuthenticated } = useAuthContext();
  const params = useLocalSearchParams<{ walk?: string }>();
  const walkState: WalkState | null =
    __DEV__ && isWalkState(params.walk) ? params.walk : null;
  const walkInput = walkState ? buildWalkInput(walkState) : null;

  const { data: primarySpotSummary } = usePrimarySpot(profile?.id ?? null);
  const { trails } = useTrails(primarySpotSummary?.spot.id ?? null);
  const { heroBeat } = useHeroBeat(profile?.id);

  // Trail focus — heroBeat wins (continuity with Home), then a manual
  // selection from the chip picker, then the first verified trail.
  const verifiedTrails = useMemo(
    () => trails.filter((t) => VERIFIED_CALIBRATIONS.has(t.calibrationStatus)),
    [trails],
  );
  const [manualTrailId, setManualTrailId] = useState<string | null>(null);
  const focusTrail: Trail | null = useMemo(() => {
    if (manualTrailId) {
      return verifiedTrails.find((t) => t.id === manualTrailId) ?? null;
    }
    if (heroBeat) {
      const fromBeat = verifiedTrails.find((t) => t.id === heroBeat.trailId);
      if (fromBeat) return fromBeat;
    }
    return verifiedTrails[0] ?? null;
  }, [verifiedTrails, manualTrailId, heroBeat]);

  const [scope, setScope] = useState<ScopeKey>('today');
  const period = scopeToPeriod(scope);
  const { entries: leaderboardRows, status: leaderboardStatus } = useLeaderboard(
    focusTrail?.id ?? '',
    period,
    profile?.id,
  );
  // History fetch — separate so we can detect "today empty but the
  // league exists" and power the proof card. When the active scope
  // is already all-time we'd be querying the same data twice; we
  // skip the redundant call by passing an empty trailId (the hook
  // short-circuits to status='empty').
  const isAllTimeScope = period === 'all_time';
  const { entries: allTimeRows } = useLeaderboard(
    isAllTimeScope ? '' : (focusTrail?.id ?? ''),
    'all_time',
    profile?.id,
  );
  const historyRows = isAllTimeScope ? leaderboardRows : allTimeRows;

  const state = useMemo(
    () =>
      deriveLeaderboardState(
        walkInput ?? {
          primarySpotSummary,
          trails,
          focusTrail,
          leaderboardRows,
          historyRows,
          currentUserId: profile?.id ?? null,
          scope,
        },
      ),
    [walkInput, primarySpotSummary, trails, focusTrail, leaderboardRows, historyRows, profile?.id, scope],
  );

  // Header subtitle reflects the walked input when present so visual
  // QA matches the rendered state. Otherwise pull from real data.
  const headerSpot = walkInput?.primarySpotSummary ?? primarySpotSummary;
  const headerFocusTrail = walkInput?.focusTrail ?? focusTrail;
  const headerSubtitle = (() => {
    if (!headerSpot) return 'Wybierz pierwszy bike park';
    const spotName = headerSpot.spot.name;
    if (headerFocusTrail) return `${spotName.toUpperCase()} · ${headerFocusTrail.name.toUpperCase()}`;
    if (verifiedTrails.length === 0 && trails.length > 0) {
      return `${spotName.toUpperCase()} · TRASA W KALIBRACJI`;
    }
    return `${spotName.toUpperCase()} · BRAK TRAS`;
  })();

  function handleHeroCta() {
    const target = resolveLeaderboardCtaRoute(state, {
      primarySpotId: primarySpotSummary?.spot.id ?? null,
      focusTrail,
    });
    if (!target) return;
    router.push(target as any);
  }

  // Anonymous flow — keep parity with Home: prompt to sign in.
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.centered}>
          <Text style={styles.signinTitle}>TABLICA</Text>
          <Text style={styles.signinBody}>
            Zaloguj się, żeby zobaczyć swoją pozycję w lidze.
          </Text>
          <Pressable
            onPress={() => router.push('/auth')}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaLabel}>ZALOGUJ SIĘ</Text>
            <Text style={styles.ctaArrow}>→</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isLoadingFocusedBoard =
    !!focusTrail && leaderboardStatus === 'loading' && leaderboardRows.length === 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.miniLabelRow}>
            <LiveDot size={6} color={colors.accent} mode="pulse" />
            <Text style={styles.miniLabel}>TABLICA</Text>
          </View>
          <Text style={styles.headline}>TABLICA</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {headerSubtitle}
          </Text>
        </View>

        <View style={styles.scopeRow}>
          <ScopeToggle value={scope} onChange={setScope} />
        </View>

        {verifiedTrails.length > 1 ? (
          <View style={styles.trailPickerRow}>
            <Text style={styles.trailPickerLabel}>TRASA</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.trailPickerChips}
            >
              {verifiedTrails.map((t) => {
                const isActive = focusTrail?.id === t.id;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setManualTrailId(t.id)}
                    style={({ pressed }) => [
                      styles.trailChip,
                      isActive && styles.trailChipActive,
                      pressed && !isActive && styles.trailChipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.trailChipLabel,
                        isActive && styles.trailChipLabelActive,
                      ]}
                    >
                      {t.name.toUpperCase()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        {isLoadingFocusedBoard ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <>
            <LeaderboardHero
              kicker={state.hero.kicker}
              title={state.hero.title}
              body={state.hero.body}
              pressureLine={state.hero.pressureLine}
              tone={state.hero.tone}
              positionBadge={state.hero.positionBadge}
              leaderTime={state.hero.leaderTime}
              gapText={state.hero.gapText}
              ctaLabel={state.cta?.label}
              onPress={state.cta ? handleHeroCta : undefined}
            />

            {state.proofCard ? (
              <LeagueProofCard
                data={state.proofCard}
                onPress={() => setScope('all_time')}
              />
            ) : null}

            {state.topRows.length > 0 ? (
              <View style={styles.podiumWrap}>
                <Text style={styles.sectionLabel}>PODIUM</Text>
                <PodiumBlock rows={state.topRows} />
              </View>
            ) : null}

            {state.stickyUserRow ? (
              <View style={styles.stickyWrap}>
                <View style={styles.stickyDivider} />
                <PodiumBlock rows={[state.stickyUserRow]} />
              </View>
            ) : null}

            {state.tailRows.length > 0 ? (
              <View style={styles.tailWrap}>
                <Text style={styles.sectionLabel}>POZOSTALI</Text>
                <PodiumBlock rows={state.tailRows} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 18,
  },
  header: {
    gap: 8,
  },
  miniLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  miniLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  headline: {
    fontFamily: fonts.racing,
    fontSize: 40,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 42,
    textTransform: 'uppercase',
  },
  sub: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  scopeRow: {
    paddingTop: 4,
  },
  trailPickerRow: {
    gap: 10,
  },
  trailPickerLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 2.4,
  },
  trailPickerChips: {
    gap: 8,
    paddingRight: 24,
  },
  trailChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  trailChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  trailChipPressed: {
    backgroundColor: colors.accentDim,
  },
  trailChipLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 1.6,
  },
  trailChipLabelActive: {
    color: colors.accent,
  },
  loaderWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  podiumWrap: {
    gap: 10,
  },
  sectionLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.textTertiary,
    letterSpacing: 2.4,
  },
  stickyWrap: {
    gap: 10,
  },
  stickyDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },
  tailWrap: {
    gap: 10,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  signinTitle: {
    fontFamily: fonts.racing,
    fontSize: 36,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  signinBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 48,
    paddingHorizontal: 32,
    borderRadius: 24,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 8,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  ctaLabel: {
    fontFamily: fonts.racing,
    fontSize: 12,
    fontWeight: '800',
    color: colors.accentInk,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
  },
  ctaArrow: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '800',
    color: colors.accentInk,
  },
});
