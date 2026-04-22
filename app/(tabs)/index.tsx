import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChallengeItem } from '@/components/ui/ChallengeItem';
import { GlowButton } from '@/components/ui/GlowButton';
import { HeroCard } from '@/components/ui/HeroCard';
import { StreakIndicator } from '@/components/ui/StreakIndicator';
import { XPBar } from '@/components/ui/XPBar';
import { PrimarySpotCard } from '@/components/home/PrimarySpotCard';
import { ranks, getRankForXp, getXpToNextRank } from '@/systems/ranks';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  useDailyChallenges,
  useHeroBeat,
  usePrimarySpot,
  useProfile,
  useStreakState,
} from '@/hooks/useBackend';
import { chunk9Colors, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

function formatChallengeCountdown(now: Date = new Date()): string {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const remainingMs = Math.max(0, midnight.getTime() - now.getTime());
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  return `${hours}h ${minutes}m`;
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

// Spec v2 section 1.3: tabBarHeight 64. Combined with safe-area bottom so
// the last scroll item (StreakIndicator / spot shortcut) clears the tab bar
// on home-indicator devices.
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
  const { data: primarySpotSummary, status: primarySpotStatus, refresh: refreshPrimarySpot } =
    usePrimarySpot(authProfile?.id ?? null);

  // Cold-start loading gate: first render, authed user, no data yet.
  // Spec v2 3.4 — never render blank. Proper Skeleton primitive comes in Chunk 9.1.
  const isColdLoading =
    isAuthenticated &&
    (profileStatus === 'loading' || heroBeatStatus === 'loading') &&
    !profile &&
    !heroBeat;

  // Spec v2 3.5: on fetch failure show honest error + retry.
  // Only escalate to full-screen error when the core signal (profile) fails —
  // secondary widgets (feed, challenges) degrade inline via their own hooks.
  const isColdError = isAuthenticated && profileStatus === 'error' && !profile;

  async function handleRetry() {
    await Promise.all([refreshProfile(), refreshHeroBeat()]);
  }

  const currentXp = profile?.xp ?? 0;
  const currentRank = getRankForXp(currentXp);
  const nextRank = getXpToNextRank(currentXp);
  const level = Math.max(1, ranks.findIndex((rank) => rank.id === currentRank.id) + 1);
  const currentLevelXp = Math.max(0, currentXp - currentRank.xpThreshold);
  const levelMaxXp = nextRank.nextRank
    ? nextRank.nextRank.xpThreshold - currentRank.xpThreshold
    : Math.max(currentLevelXp, 1);

  const challengeCompletionRatio =
    challenges.length > 0
      ? challenges.filter((challenge) => challenge.completed).length / challenges.length
      : 0;

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
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleInviteRival() {
    const url = Linking.createURL('/');
    await Share.share({
      message: `Wbijaj do NWD i spróbuj mnie wyprzedzić. ${url}`,
    });
  }

  if (isColdLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={chunk9Colors.accent.emerald} />
        </View>
      </SafeAreaView>
    );
  }

  if (isColdError) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.errorTitle}>Tryb awaryjny</Text>
          <Text style={styles.errorBody}>
            Ranking nie dojechał. Sprawdź sieć i spróbuj jeszcze raz.
          </Text>
          <GlowButton label="Spróbuj ponownie" variant="secondary" onPress={handleRetry} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={chunk9Colors.accent.emerald}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.brand}>NWD</Text>
            <Text style={styles.brandSub}>LIGA GRAVITY</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isAuthenticated
                ? `Profil: ${currentRank.name}, poziom ${level}`
                : 'Zaloguj się'
            }
            onPress={() => router.push(isAuthenticated ? '/(tabs)/profile' : '/auth')}
            style={styles.xpWrap}
          >
            <XPBar
              current={currentLevelXp}
              max={levelMaxXp}
              rank={currentRank.name}
              level={level}
              compact
            />
          </Pressable>
        </View>

        {/*
         * Fresh-rider priority: a user with no runs AND no primary spot
         * has one job — add a bike park and carve their first trail.
         * Showing "Dziś bez zmian · Zaproś rywala" above that CTA inverts
         * the priority (social feature they can't use yet). So for zero-
         * state we promote PrimarySpotCard(empty) to hero position and
         * skip the empty HeroCard entirely. Once they have a run, the
         * normal hero beat / stable-day copy resumes on top.
         */}
        {(() => {
          const hasHeroBeat = !!heroBeat;
          const hasPrimarySpot = !!primarySpotSummary;
          const isFreshRider =
            !hasHeroBeat &&
            !hasPrimarySpot &&
            (profile?.totalRuns ?? 0) === 0;

          const heroCard = hasHeroBeat ? (
            <HeroCard
              variant="active"
              trailName={heroBeat!.trailName}
              beaterName={heroBeat!.beaterName}
              happenedAt={heroBeat!.happenedAt}
              deltaMs={heroBeat!.deltaMs}
              beaterTimeMs={heroBeat!.beaterTimeMs}
              userTimeMs={heroBeat!.userTimeMs}
              onPrimary={() =>
                router.push({
                  pathname: '/run/active',
                  params: {
                    trailId: heroBeat!.trailId,
                    trailName: heroBeat!.trailName,
                  },
                })
              }
            />
          ) : isFreshRider ? null : (
            <HeroCard variant="empty" onSecondary={handleInviteRival} />
          );

          const spotCardVisible =
            primarySpotStatus !== 'signed_out' && primarySpotStatus !== 'error';
          const spotCard = spotCardVisible
            ? hasPrimarySpot
              ? (
                <PrimarySpotCard
                  variant="active"
                  spotId={primarySpotSummary!.spot.id}
                  spotName={primarySpotSummary!.spot.name}
                  trailCount={primarySpotSummary!.trailCount}
                  bestDurationMs={primarySpotSummary!.bestDurationMs}
                />
              )
              : primarySpotStatus === 'empty'
                ? <PrimarySpotCard variant="empty" />
                : null
            : null;

          // Fresh rider → spot card is THE hero. Everyone else → normal order.
          return isFreshRider ? (
            <>{spotCard}{heroCard}</>
          ) : (
            <>{heroCard}{spotCard}</>
          );
        })()}

        {/*
         * B1 density reduction: shortened header from
         * 'DZIENNE WYZWANIA · WYGASAJĄ ZA Xh Ym' to
         * 'WYZWANIA · Xh Ym'. Subtitle per challenge loses the
         * 'RESET 00:00' eyebrow — the section header already
         * conveys the countdown.
         */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>WYZWANIA</Text>
            <Text style={styles.sectionMeta}>{formatChallengeCountdown()}</Text>
          </View>

          <View style={styles.challengeProgressTrack}>
            <View
              style={[
                styles.challengeProgressFill,
                { width: `${challengeCompletionRatio * 100}%` },
              ]}
            />
          </View>

          <View style={styles.sectionBody}>
            {challenges.map((challenge) => (
              <ChallengeItem
                key={challenge.id}
                challenge={{
                  id: challenge.id,
                  title: challenge.title,
                  subtitle: `${challenge.current}/${challenge.target}`,
                  xpLabel: `+${challenge.rewardXp} XP`,
                }}
                progress={{ completed: challenge.completed }}
              />
            ))}
          </View>
        </View>

        {/* B1: RUCH W LIDZE removed from home. Feed belongs on the
            RIDER tab (handoff B1) — keeps home focused on "what should
            I do right now" instead of "what are others doing". */}

        <StreakIndicator
          days={streak?.days ?? 0}
          mode={streak?.mode ?? 'safe'}
          subtitle={streakSubtitle}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: chunk9Colors.bg.base,
  },
  scrollContent: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    gap: chunk9Spacing.sectionVertical,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: chunk9Spacing.cardChildGap,
  },
  brand: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
  },
  brandSub: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
    marginTop: 2,
  },
  xpWrap: {
    width: 132,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: chunk9Spacing.cardChildGap,
  },
  sectionTitle: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
    flexShrink: 1,
  },
  sectionMeta: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
    textAlign: 'right',
  },
  challengeProgressTrack: {
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: chunk9Colors.bg.hairline,
  },
  challengeProgressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: chunk9Colors.accent.emerald,
  },
  sectionBody: {
    gap: 4,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    gap: chunk9Spacing.cardChildGap,
  },
  errorTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    textAlign: 'center',
  },
  errorBody: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    textAlign: 'center',
  },
});
