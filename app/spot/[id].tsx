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
import { useState } from 'react';
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
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
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
  type TrailStatus,
} from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import { useBikeParkTrails, useDeleteSpot, useSpot } from '@/hooks/useBackend';
import { pickRunDestination } from '@/features/run/pickRunDestination';
import { formatTimeShort } from '@/content/copy';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type SpotDisplayState = 'no_trails' | 'all_calibrating' | 'mixed' | 'all_verified';

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

function resolveTrailStatus(calibrationStatus?: string | null): TrailStatus {
  const c = (calibrationStatus ?? '').toLowerCase();
  if (c === 'calibrating' || c === 'fresh_pending_second_run') return 'validating';
  if (c === 'locked') return 'closed';
  return 'open';
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
    // Open ranking on the first trail (canonical UX — board scoped to
    // a trail). User can switch trails inside leaderboard tab.
    router.replace({
      pathname: '/(tabs)/leaderboard',
      params: { trailId: trails[0].trail.id, scope: 'all_time' },
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
        <TopBar
          onBack={handleGoBack}
          title="Spot"
          trailing={<Pill state="neutral" size="sm">Beta</Pill>}
        />

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
              Tablica
            </Btn>
          </View>
        ) : null}

        {/* ═════ PIONEER VALIDATION BANNER ═════ */}
        {spotDisplayState === 'all_calibrating' ? (
          <View style={styles.banner}>
            <IconGlyph name="timer" size={14} color={colors.warn} />
            <Text style={styles.bannerText}>
              Trasy w walidacji — drugi spójny zjazd Pioniera otworzy ranking.
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
                const trailStatus = resolveTrailStatus(t.calibrationStatus);
                const pioneerLabel = t.pioneerStatusLabel
                  ? <Pill state={t.pioneerStatusLabel === 'PIONIER' ? 'accent' : 'pending'} size="xs">{t.pioneerStatusLabel}</Pill>
                  : undefined;

                return (
                  <TrailCard
                    key={t.trail.id}
                    name={t.trail.name}
                    difficulty={t.trail.difficulty}
                    trailType={t.trail.type}
                    status={trailStatus}
                    length={lengthKm}
                    pbTime={t.userData.pbMs ? formatTimeShort(t.userData.pbMs) : null}
                    rank={t.userData.position ?? null}
                    pioneerLabel={pioneerLabel}
                    highlight={t.state === 'beaten' || !!t.userData.lastRanAt}
                    onPress={() =>
                      router.push(
                        pickRunDestination({
                          trailId: t.trail.id,
                          spotId: spot.id,
                          trailName: t.trail.name,
                          calibrationStatus: t.calibrationStatus,
                          intent:
                            t.state === 'pioneer'
                            && t.calibrationStatus === 'fresh_pending_second_run'
                              ? 'ranked'
                              : undefined,
                        }),
                      )
                    }
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
              Pionieruj.{'\n'}Zdefiniuj linię.{'\n'}Wyzwij innych.
            </Text>
            <View style={styles.howItWorks}>
              <View style={styles.howCell}>
                <Text style={styles.howIndex}>01</Text>
                <Text style={styles.howItem}>TELEFON DO KIESZENI</Text>
              </View>
              <View style={styles.howCell}>
                <Text style={styles.howIndex}>02</Text>
                <Text style={styles.howItem}>ZJEDŹ RAZ</Text>
              </View>
              <View style={styles.howCell}>
                <Text style={styles.howIndex}>03</Text>
                <Text style={styles.howItem}>RANKING GOTOWY</Text>
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
