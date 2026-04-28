// ─────────────────────────────────────────────────────────────
// Home tab — Race Day Command Center.
//
// The screen answers one question: "co teraz robię?". Home is a
// state machine — deriveHomeMission() returns exactly one mission
// per render, and HomeMissionCard ALWAYS renders. There is no
// empty/missing-data branch on Home.
//
// Layout:
//   1. Context header — venue is the H1; status summarizes trails
//      + rider position when known.
//   2. Mission card — adapts to NO_SPOT, NO_TRAILS, TRAIL_CALIBRATING,
//      VERIFIED_NO_USER_TIME, USER_LEADS, USER_BEATEN, USER_HAS_TIME.
//      Mission tone (green/amber) tints the kicker + position badge;
//      CTA stays green (action). See @/features/home/mission.
//   3. Live ticker — community drama feed.
//   4. Quest progress chip — collapsed daily challenges.
//   5. Streak indicator — identity-anchor at the bottom.
//
// Profile stats, XP and the bike-park card live on the JA tab.
// Anonymous flow is unchanged.
// ─────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StreakIndicator } from '@/components/ui/StreakIndicator';
import { SyncOutboxCard } from '@/components/sync/SyncOutboxCard';
import { HomeMissionCard } from '@/components/home/HomeMissionCard';
import { formatTimeShort } from '@/content/copy';
import {
  AmbientScan,
  Btn,
  LiveTicker,
  SectionHead,
} from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  useDailyChallenges,
  useHeroBeat,
  usePrimarySpot,
  useProfile,
  useStreakState,
  useTrails,
} from '@/hooks/useBackend';
import { deriveHomeMission, type HomeMission } from '@/features/home/mission';
import { resolveHomeMissionRoute } from '@/features/home/route';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

function formatChallengeCountdown(now: Date = new Date()): string {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const remainingMs = Math.max(0, midnight.getTime() - now.getTime());
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
}

// "5 min temu" / "2h temu" / "wczoraj" — minimal Polish relative formatter.
// Used for hero pressure line; precise enough for "Kacper przejął #1 · 14 min temu".
function formatRelativePl(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  if (diffMs < 60_000) return 'przed chwilą';
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h temu`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'wczoraj' : `${days} dni temu`;
}

// Polish plural for "trasa" (1) / "trasy" (2-4) / "tras" (5+, 0).
function trasaWord(n: number): string {
  if (n === 1) return 'trasa';
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return 'tras';
  if (lastOne >= 2 && lastOne <= 4) return 'trasy';
  return 'tras';
}

// "1 trasa aktywna" / "2 trasy aktywne" / "5 tras aktywnych".
// Used in the context-header status; the noun + adjective must agree.
function activeTrailsLabel(n: number): string {
  if (n === 1) return '1 trasa aktywna';
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return `${n} tras aktywnych`;
  if (lastOne >= 2 && lastOne <= 4) return `${n} trasy aktywne`;
  return `${n} tras aktywnych`;
}

function buildStreakSubtitle(params: {
  days: number;
  currentDayComplete: boolean;
  mode: 'safe' | 'warn';
  remainingHours: number;
  remainingMinutes: number;
}): string {
  if (params.days <= 0) return 'Zjedź dziś żeby zacząć';
  if (params.currentDayComplete) return 'Dziś już zaliczone';
  if (params.mode === 'warn') {
    return `Zjedź dziś żeby nie stracić · ~${params.remainingHours}h ${params.remainingMinutes}m`;
  }
  return 'Zjedź dziś żeby utrzymać';
}

const TAB_BAR_CLEARANCE = 64;

export default function HomeScreen() {
  const router = useRouter();
  const { profile: authProfile, isAuthenticated } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const { profile, status: profileStatus, refresh: refreshProfile } = useProfile(authProfile?.id);
  const { heroBeat, status: heroBeatStatus, refresh: refreshHeroBeat } = useHeroBeat(authProfile?.id);
  const { challenges, refresh: refreshChallenges } = useDailyChallenges(authProfile?.id);
  const { streak, refresh: refreshStreak } = useStreakState(authProfile?.id);
  const { data: primarySpotSummary, refresh: refreshPrimarySpot } =
    usePrimarySpot(authProfile?.id ?? null);
  const { trails, refresh: refreshTrails } = useTrails(primarySpotSummary?.spot.id ?? null);

  useFocusEffect(
    useCallback(() => {
      void refreshPrimarySpot();
      void refreshTrails();
    }, [refreshPrimarySpot, refreshTrails]),
  );

  const isColdLoading =
    isAuthenticated &&
    (profileStatus === 'loading' || heroBeatStatus === 'loading') &&
    !profile &&
    !heroBeat;
  const isColdError = isAuthenticated && profileStatus === 'error' && !profile;

  async function handleRetry() {
    await Promise.all([refreshProfile(), refreshHeroBeat()]);
  }

  const challengesDone = challenges.filter((c) => c.completed).length;
  const challengesTotal = challenges.length;
  const challengeCompletionRatio =
    challengesTotal > 0 ? challengesDone / challengesTotal : 0;
  // "Najbliżej" hint = the first uncompleted quest. Adds one line of
  // forward-momentum copy under the progress bar without reintroducing
  // the full checkbox list (which used to compete with the hero CTA).
  const nextChallenge = challenges.find((c) => !c.completed) ?? null;

  // ── Mission state machine ─────────────────────────────────────
  // Home always renders exactly one primary mission card; the kind
  // is derived purely from real data with no invented copy.
  const mission: HomeMission = deriveHomeMission({
    primarySpotSummary,
    trails,
    heroBeat,
    beaterRelativeTime: heroBeat?.happenedAt
      ? formatRelativePl(heroBeat.happenedAt)
      : null,
  });

  // Context-header H1 + status. For NO_SPOT we show a generic prompt
  // (no venue exists yet); other states surface the actual bike park.
  const headerVenueLine = mission.kind === 'NO_SPOT'
    ? 'TWOJA ARENA'
    : (primarySpotSummary?.spot.name ?? 'Twój bike park').toUpperCase();

  // Status line is mission-driven: each state has its own concrete copy
  // anchored in real data (trail count, PB, current position). We only
  // mention what we can verify — never invent a position or a leader.
  const contextStatusLine = (() => {
    const trailCount = primarySpotSummary?.trailCount ?? 0;
    const userPb =
      heroBeat?.userTimeMs
      ?? primarySpotSummary?.bestDurationMs
      ?? null;
    switch (mission.kind) {
      case 'NO_SPOT':
        return 'Wybierz pierwszy bike park';
      case 'NO_TRAILS':
        return '0 aktywnych tras · pionier potrzebny';
      case 'TRAIL_CALIBRATING':
        return `${trasaWord(trailCount)} w kalibracji`;
      case 'VERIFIED_NO_USER_TIME':
        return `${activeTrailsLabel(trailCount)} · pierwszy czas czeka`;
      case 'USER_LEADS':
        return userPb
          ? `${trailCount} ${trasaWord(trailCount)} · jesteś #1 · PB ${formatTimeShort(userPb)}`
          : `${trailCount} ${trasaWord(trailCount)} · jesteś #1`;
      case 'USER_BEATEN':
        return `${trailCount} ${trasaWord(trailCount)} · spadłeś na #${heroBeat!.currentPosition}`;
      case 'USER_HAS_TIME':
        return userPb
          ? `${trailCount} ${trasaWord(trailCount)} · Twój PB ${formatTimeShort(userPb)}`
          : `${trailCount} ${trasaWord(trailCount)}`;
    }
  })();

  function handleMissionPress() {
    const target = resolveHomeMissionRoute(mission, {
      primarySpotId: primarySpotSummary?.spot.id ?? null,
    });
    if (!target) return;
    router.push(target as any);
  }

  const streakSubtitle = buildStreakSubtitle({
    days: streak?.days ?? 0,
    currentDayComplete: streak?.currentDayComplete ?? false,
    mode: streak?.mode ?? 'safe',
    remainingHours: streak?.remainingHours ?? 0,
    remainingMinutes: streak?.remainingMinutes ?? 0,
  });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshProfile(),
        refreshHeroBeat(),
        refreshChallenges(),
        refreshStreak(),
        refreshPrimarySpot(),
        refreshTrails(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  // Must sit above every conditional early-return below — moving it
  // under `if (isColdLoading) return ...` makes the hook count drop
  // on first render and grow on the next, which is a rules-of-hooks
  // violation that React surfaces as a sync render throw.
  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth');
  }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  if (isColdLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (isColdError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.errorTitle}>TRYB AWARYJNY</Text>
          <Text style={styles.errorBody}>
            Ranking nie dojechał. Sprawdź sieć i spróbuj jeszcze raz.
          </Text>
          <Btn variant="ghost" size="md" fullWidth={false} onPress={handleRetry}>
            Spróbuj ponownie
          </Btn>
        </View>
      </SafeAreaView>
    );
  }

  // ── Authed flow — Race Day Command Center.
  // One screen, one question: "co teraz robię?". The context header
  // names the venue; the mission card answers with a position-aware
  // (or empty-state-aware) hero. Mission state machine guarantees
  // the hero ALWAYS renders — there is no empty Home.
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AmbientScan />
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* CONTEXT HEADER — venue is the H1 of the screen. */}
        <View style={styles.contextHeader}>
          <View style={styles.contextKickerRow}>
            <View style={styles.contextDot} />
            <Text style={styles.contextKicker}>DZIŚ NA GÓRZE</Text>
          </View>
          <Text style={styles.contextTitle} numberOfLines={2}>
            {headerVenueLine}
          </Text>
          <Text style={styles.contextStatus} numberOfLines={1}>
            {contextStatusLine}
          </Text>
        </View>

        <SyncOutboxCard />

        <HomeMissionCard
          kicker={mission.kicker}
          title={mission.title}
          body={mission.body}
          pressureLine={mission.pressureLine}
          ctaLabel={mission.cta}
          tone={mission.tone}
          positionBadge={mission.positionBadge}
          komTime={mission.komTime}
          yourDeltaText={mission.yourDeltaText}
          venueName={mission.venueName}
          onPress={handleMissionPress}
        />

        {/* COMMUNITY PULSE — drama feed under the hero. Suppresses
            pioneer events while the active mission is a ranked run
            (otherwise the slot reads like a competing CTA). Renders
            related-trail events in their accent color, unrelated ones
            muted, and a quiet pulse line if nothing remains. */}
        <View style={styles.tickerWrap}>
          <LiveTicker
            title="LIVE · LIGA"
            currentTrailName={mission.trailName}
            suppressKinds={mission.action === 'RANKED_RUN' ? ['pioneer'] : []}
            emptyCopy="Pierwszy wynik dnia ustawi tablicę."
          />
        </View>

        {/* QUEST PROGRESS CHIP — collapsed challenge section.
            Detail (per-quest checkboxes + reward XP) lives elsewhere;
            Home only conveys "where am I in today's quests". */}
        {challengesTotal > 0 ? (
          <View style={styles.questChip}>
            <View style={styles.questHeaderRow}>
              <Text style={styles.questLabel}>WYZWANIA DNIA</Text>
              <Text style={styles.questCount}>
                {challengesDone}/{challengesTotal} · do północy {formatChallengeCountdown()}
              </Text>
            </View>
            <View style={styles.challengeProgressTrack}>
              <View
                style={[
                  styles.challengeProgressFill,
                  { width: `${challengeCompletionRatio * 100}%` },
                ]}
              />
            </View>
            {nextChallenge ? (
              <Text style={styles.questHint} numberOfLines={1}>
                Najbliżej: {nextChallenge.title} · +{nextChallenge.rewardXp} XP
              </Text>
            ) : null}
          </View>
        ) : null}

        <View>
          <SectionHead
            label="Passa"
            icon={(streak?.days ?? 0) > 0 ? 'verified' : 'timer'}
          />
          <StreakIndicator
            days={streak?.days ?? 0}
            mode={streak?.mode ?? 'safe'}
            subtitle={streakSubtitle}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.pad,
    gap: spacing.lg,
  },
  tickerWrap: {
    marginBottom: 4,
  },
  contextHeader: {
    paddingTop: spacing.sm,
    gap: 8,
  },
  contextKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  contextDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  contextKicker: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.4,
  },
  contextTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 40,
    lineHeight: 42,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.4,
    textTransform: 'uppercase',
  },
  contextStatus: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  questChip: {
    gap: 10,
    paddingVertical: 4,
  },
  questHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  questLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2.4,
  },
  questCount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },
  questHint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
    marginTop: 2,
  },
  challengeProgressTrack: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: colors.border,
  },
  challengeProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.accent,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.pad,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.label,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.64,
    textAlign: 'center',
  },
  errorBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
});
