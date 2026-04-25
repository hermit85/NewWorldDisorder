// ─────────────────────────────────────────────────────────────
// Home tab — canonical shell over existing widgets
//
// Reshapes the screen chrome to match design-system/screens-home.jsx
// ScreenHome: NWD brand header, "Sezon 01" pill, anonymous hero
// Card with Pill kicker + Btn primary, section heads via canonical
// SectionHead, empty/error states using canonical Btn.
//
// Inner widgets (HeroCard, PrimarySpotCard, ChallengeItem,
// StreakIndicator, XPBar) keep their existing implementations —
// they'll be migrated screen-by-screen as a follow-up. They already
// render with correct color values via the chunk9 alias layer.
// ─────────────────────────────────────────────────────────────
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChallengeItem } from '@/components/ui/ChallengeItem';
import { HeroCard } from '@/components/ui/HeroCard';
import { StreakIndicator } from '@/components/ui/StreakIndicator';
import { XPBar } from '@/components/ui/XPBar';
import { PrimarySpotCard } from '@/components/home/PrimarySpotCard';
import {
  Btn,
  Card,
  Pill,
  SectionHead,
} from '@/components/nwd';
import { getRankForXp } from '@/systems/ranks';
import { getLevelProgress } from '@/systems/xp';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  useDailyChallenges,
  useHeroBeat,
  usePrimarySpot,
  useProfile,
  useStreakState,
} from '@/hooks/useBackend';
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
  const { data: primarySpotSummary, status: primarySpotStatus, refresh: refreshPrimarySpot } =
    usePrimarySpot(authProfile?.id ?? null);

  const isColdLoading =
    isAuthenticated &&
    (profileStatus === 'loading' || heroBeatStatus === 'loading') &&
    !profile &&
    !heroBeat;
  const isColdError = isAuthenticated && profileStatus === 'error' && !profile;

  async function handleRetry() {
    await Promise.all([refreshProfile(), refreshHeroBeat()]);
  }

  const currentXp = profile?.xp ?? 0;
  const currentRank = getRankForXp(currentXp);
  const levelProgress = getLevelProgress(currentXp);
  const level = levelProgress.level;
  const currentLevelXp = levelProgress.currentXp;
  const levelMaxXp = levelProgress.nextLevelXp;

  const challengeCompletionRatio =
    challenges.length > 0
      ? challenges.filter((c) => c.completed).length / challenges.length
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

  // ── Anonymous flow — canonical Card + Pill + Btn ─────────────
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + TAB_BAR_CLEARANCE },
          ]}
        >
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.brand}>NWD</Text>
              <Text style={styles.brandSub}>LIGA GRAVITY</Text>
            </View>
            <Pill state="neutral" size="md">Sezon 01</Pill>
          </View>

          <Card hi glow padding={20} style={styles.anonCard}>
            <Pill state="accent">Sezon 01 · Słotwiny</Pill>
            <Text style={styles.anonTitle}>Dołącz do ligi</Text>
            <Text style={styles.anonBody}>
              Stwórz rider tag, zapisuj zjazdy, walcz o miejsce na tablicy.
            </Text>
            <Btn
              variant="primary"
              size="lg"
              onPress={() => router.push('/auth')}
            >
              Zaloguj się
            </Btn>
          </Card>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Authed flow — keep existing widgets, canonical shell ─────
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
            tintColor={colors.accent}
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
            accessibilityLabel={`Profil: ${currentRank.name}, poziom ${level}`}
            onPress={() => router.push('/(tabs)/profile')}
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
                    intent: 'ranked',
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

          return isFreshRider ? (
            <>{spotCard}{heroCard}</>
          ) : (
            <>{heroCard}{spotCard}</>
          );
        })()}

        <View style={styles.section}>
          <SectionHead
            label="Wyzwania"
            icon="bike"
            count={formatChallengeCountdown()}
          />

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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  brand: {
    ...typography.title,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 28,
    lineHeight: 28,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 1.68, // 0.06em @ 28
  },
  brandSub: {
    ...typography.micro,
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2.2, // 0.22em @ 10
    fontWeight: '700',
  },
  xpWrap: {
    width: 132,
  },
  section: {
    gap: 10,
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
  sectionBody: {
    gap: 4,
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
  // Canonical anon hero card. Card component supplies the surface
  // (panel/borderHot/glow); these styles handle interior typography
  // only — replaces the prior bespoke `anonCard` with accent border
  // (decoration §01 violation) and chunk9 tokens.
  anonCard: {
    gap: 12,
    marginTop: spacing.sm,
  },
  anonTitle: {
    ...typography.title,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 28,
    lineHeight: 28,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.28, // -0.01em @ 28
    textTransform: 'uppercase',
  },
  anonBody: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
