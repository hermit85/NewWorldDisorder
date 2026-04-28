// ─────────────────────────────────────────────────────────────
// Spot detail — canonical screens-spot-trail.jsx ScreenSpotDetail
//
// Layout per the canonical reference:
//   TopBar         back btn + title "Spot" + season pill trailing
//   Hero           Bike park kicker pill + h1 spot name + region
//   Stats grid     3-col StatBox: Trasy / Riderzy (accent) / Zjazdy
//   Action row     ghost btn "Tablica" → leaderboard
//   Pioneer banner Card warning when all trails calibrating
//   SectionHead    "Trasy" + count
//   TrailCard list canonical card-style trail rows
//   Outline btn    "+ Dodaj trasę"
//
// The map-first BPH STATE A variant lives in src/components/ui/
// (BikeParkMap, CheckInPill, FabStartRun) for a future "AT THE
// PARK" mode unlocked by GPS proximity. Default browse view is
// list-first per canonical screens-spot-trail.jsx.
// ─────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Btn,
  IconGlyph,
  PageTitle,
  Pill,
  SectionHead,
  StatBox,
  TopBar,
  TrailCard,
} from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import { useBikeParkTrails, useDeleteSpot, useSpot } from '@/hooks/useBackend';
import { getTrailDisplayState } from '@/features/trails/trailLifecycle';
import { formatTimeShort } from '@/content/copy';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type SpotDisplayState = 'no_trails' | 'all_calibrating' | 'mixed' | 'all_verified';

const RANKING_CALIBRATIONS = new Set([
  'verified',
  'locked',
  'live_fresh',
  'live_confirmed',
  'stable',
]);

function computeSpotState(
  trails: { calibrationStatus?: string }[],
): SpotDisplayState {
  if (trails.length === 0) return 'no_trails';
  const verified = trails.filter((t) =>
    ['verified', 'locked', 'live_fresh', 'live_confirmed', 'stable'].includes(t.calibrationStatus ?? ''),
  ).length;
  const calibrating = trails.filter((t) =>
    ['calibrating', 'fresh_pending_second_run'].includes(t.calibrationStatus ?? ''),
  ).length;
  if (calibrating === trails.length) return 'all_calibrating';
  if (verified === trails.length) return 'all_verified';
  return 'mixed';
}

const BOTTOM_CTA_CLEARANCE = 24;

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const { spot, status: spotStatus, refresh: refreshSpot } = useSpot(id ?? null);
  const { trails, refresh: refreshTrails } = useBikeParkTrails(id ?? null, profile?.id);
  const { submit: deleteSpot } = useDeleteSpot();

  useFocusEffect(
    useCallback(() => {
      void refreshSpot();
      void refreshTrails();
    }, [refreshSpot, refreshTrails]),
  );

  const isCurator = profile?.role === 'curator' || profile?.role === 'moderator';
  const spotDisplayState = computeSpotState(trails);

  // Aggregate active riders across trails so the stats grid has a
  // real number even when spot.activeRidersToday hasn't backfilled.
  const aggregateActiveRiders = trails.reduce(
    (sum, t) => sum + (t.trail.activeRidersCount ?? 0),
    0,
  );

  // Total runs across the spot — sum of totalRanked from each trail's
  // userData. Approximation but matches the canonical "Zjazdy" stat.
  const totalRuns = trails.reduce(
    (sum, t) => sum + (t.userData.totalRanked ?? 0),
    0,
  );

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refreshSpot(), refreshTrails()]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleGoBack() {
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
  }

  function handleOpenLeaderboard() {
    if (!spot || trails.length === 0) return;
    // Open ranking on a trail that actually has a leaderboard. In a mixed
    // spot (one validating trail + one live trail), using trails[0] can point
    // at the validating route and make Tablica look like stale cache.
    const rankingTrail =
      trails.find((t) => RANKING_CALIBRATIONS.has(t.calibrationStatus ?? '')) ??
      trails[0];
    router.replace({
      pathname: '/(tabs)/leaderboard',
      params: { trailId: rankingTrail.trail.id, scope: 'all_time' },
    });
  }

  function handleDeleteSpot() {
    if (!spot) return;
    Alert.alert(
      `Usunąć bike park ${spot.name}?`,
      'Wszystkie trasy i wyniki zostaną usunięte.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteSpot(spot.id);
            if (result.ok) handleGoBack();
            else Alert.alert(`Nie udało się: ${result.code}`, result.message ?? 'Spróbuj ponownie');
          },
        },
      ],
    );
  }

  // Loading + error gates
  if (spotStatus === 'loading' && !spot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (spotStatus === 'error' && !spot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notFoundState}>
          <Text style={styles.notFoundTitle}>BIKE PARK NIE DOJECHAŁ</Text>
          <Text style={styles.notFoundBody}>
            Sprawdź połączenie i spróbuj jeszcze raz.
          </Text>
          <Btn variant="primary" size="lg" onPress={refreshSpot}>
            SPRÓBUJ JESZCZE RAZ
          </Btn>
        </View>
      </SafeAreaView>
    );
  }

  if (!spot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notFoundState}>
          <Text style={styles.notFoundTitle}>BIKE PARK NIE ZNALEZIONY</Text>
          <Text style={styles.notFoundBody}>
            Ten link nie prowadzi już do żadnego spotu.
          </Text>
          <Btn variant="primary" size="lg" onPress={handleGoBack}>
            WRÓĆ DO LISTY
          </Btn>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + BOTTOM_CTA_CLEARANCE },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <TopBar onBack={handleGoBack} title="Spot" />

        {/* ═════ HERO — kicker pill + h1 + region ═════ */}
        <View style={styles.hero}>
          <View style={styles.heroPillRow}>
            <Pill state="accent">Bike park</Pill>
          </View>
          <PageTitle
            title={spot.name}
            hero
          />
          <View style={styles.locRow}>
            <IconGlyph name="spot" size={12} color={colors.textSecondary} />
            <Text style={styles.locText} numberOfLines={1}>
              {spot.region.toUpperCase()}
              {spot.trailCount > 0 ? ` · ${spot.trailCount} TRAS` : ''}
            </Text>
          </View>
        </View>

        {/* ═════ STATS GRID ═════ */}
        <View style={styles.statsGrid}>
          <StatBox label="Trasy" value={trails.length} style={{ flex: 1 }} />
          <StatBox
            label="Riderzy"
            value={Math.max(spot.activeRidersToday, aggregateActiveRiders)}
            accent
            style={{ flex: 1 }}
          />
          <StatBox label="Zjazdy" value={totalRuns} style={{ flex: 1 }} />
        </View>

        {/* ═════ ACTION ROW ═════ */}
        {trails.length > 0 ? (
          <View style={styles.actionRow}>
            <Btn
              variant="ghost"
              size="md"
              icon={<IconGlyph name="podium" size={16} color={colors.textPrimary} />}
              onPress={handleOpenLeaderboard}
            >
              Ranking
            </Btn>
          </View>
        ) : null}

        {/* ═════ PIONEER VALIDATION BANNER ═════ */}
        {spotDisplayState === 'all_calibrating' ? (
          <View style={styles.banner}>
            <IconGlyph name="timer" size={14} color={colors.warn} />
            <Text style={styles.bannerText}>
              Nowe trasy są gotowe do jazdy. Pierwsze przejazdy rankingowe pomagają potwierdzić linię.
            </Text>
          </View>
        ) : null}

        {/* ═════ TRAILS LIST ═════ */}
        {spotDisplayState !== 'no_trails' ? (
          <View style={styles.section}>
            <SectionHead
              icon="line"
              label="Trasy"
              count={trails.length}
            />
            <View style={styles.trailList}>
              {trails.map((t) => {
                const lengthKm = t.trail.distanceM > 0
                  ? `${(t.trail.distanceM / 1000).toFixed(1)} km`
                  : null;
                const display = getTrailDisplayState({
                  calibrationStatus: t.calibrationStatus,
                });
                const lifecycleLabel = (
                  <Pill state={display.pillState} size="xs" dot={display.kind === 'new'}>
                    {display.label}
                  </Pill>
                );

                return (
                  <TrailCard
                    key={t.trail.id}
                    name={t.trail.name}
                    difficulty={t.trail.difficulty}
                    trailType={t.trail.type}
                    status={display.cardStatus}
                    length={lengthKm}
                    pbTime={t.userData.pbMs ? formatTimeShort(t.userData.pbMs) : null}
                    rank={t.userData.position ?? null}
                    ctaLabel="Szczegóły"
                    pioneerLabel={lifecycleLabel}
                    highlight={t.state === 'beaten' || !!t.userData.lastRanAt}
                    onPress={() => router.push(`/trail/${t.trail.id}`)}
                  />
                );
              })}
            </View>

            <Btn
              variant="ghost"
              size="md"
              icon={<IconGlyph name="plus" size={16} color={colors.textPrimary} />}
              onPress={() => router.push(`/trail/new?spotId=${spot.id}`)}
            >
              Dodaj trasę
            </Btn>
          </View>
        ) : (
          // Empty pioneer pitch — first time on this spot.
          <View style={styles.empty}>
            <Pill state="accent">Pioneer slot wolny</Pill>
            <Text style={styles.emptyTitle}>
              Nazwij trasę.{'\n'}Nagraj linię.{'\n'}Otwórz ligę.
            </Text>
            <View style={styles.howItWorks}>
              <View style={styles.howCell}>
                <Text style={styles.howIndex}>01</Text>
                <Text style={styles.howItem}>NAZWIJ TRASĘ</Text>
              </View>
              <View style={styles.howCell}>
                <Text style={styles.howIndex}>02</Text>
                <Text style={styles.howItem}>NAGRAJ PIERWSZY ZJAZD</Text>
              </View>
              <View style={styles.howCell}>
                <Text style={styles.howIndex}>03</Text>
                <Text style={styles.howItem}>PIERWSZE CZASY W LIDZE</Text>
              </View>
            </View>
            <Btn
              variant="primary"
              size="lg"
              onPress={() => router.push(`/trail/new?spotId=${spot.id}`)}
            >
              + Zostań Pionierem
            </Btn>
          </View>
        )}

        {isCurator ? (
          <Pressable onPress={handleDeleteSpot} style={styles.deleteLink}>
            <Text style={styles.deleteLinkText}>Usuń ten bike park</Text>
          </Pressable>
        ) : null}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.pad,
  },
  // Not-found state — Pattern 5: muted CAPS title + body + primary
  // CTA, vertically centered, never apologetic. Distinct from
  // `emptyTitle` below (which is the larger headline used for the
  // onboarding-style empty bike-park hub).
  notFoundState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  notFoundTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.64,
    color: colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  notFoundBody: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.md,
  },

  hero: {
    gap: 14,
    paddingTop: 4,
  },
  heroPillRow: {
    flexDirection: 'row',
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locText: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 1.98, // 0.18em @ 11
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },

  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 176, 32, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 176, 32, 0.25)',
    borderRadius: 14,
    padding: 12,
  },
  bannerText: {
    ...typography.body,
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  section: {
    gap: 10,
  },
  trailList: {
    gap: 8,
  },

  empty: {
    alignItems: 'flex-start',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 20,
    gap: 14,
  },
  emptyTitle: {
    ...typography.title,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 28,
    lineHeight: 32,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.28,
    textTransform: 'uppercase',
  },
  howItWorks: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  howCell: {
    flex: 1,
    gap: 4,
  },
  howIndex: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2.0, // 0.20em @ 10
    color: colors.accent,
    fontWeight: '800',
  },
  howItem: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.44, // 0.16em @ 9
    color: colors.textSecondary,
    fontWeight: '700',
  },

  deleteLink: {
    alignSelf: 'center',
    paddingTop: 12,
  },
  deleteLinkText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
  },
});
