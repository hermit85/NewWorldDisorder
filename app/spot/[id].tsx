// ─────────────────────────────────────────────────────────────
// Spot (Bike Park Hub) screen
//
// Visual language: design-system/Bike Park Hub.html · STATE B
// (full-sheet variant). The map canvas from STATE A isn't shipped
// yet — that needs a real Mapbox / MapLibre layer + trail SVG
// overlays — but the chrome below the map (header, conditions
// strip, hot-lap banner, trail rows, filters, leaderboard peek)
// fully matches the design.
//
// Architecture:
//   - BikeParkHeader   logo + name + region + WARUNKI/TRAS/AKTYWNI
//   - HotLapStrip      gold banner — fastest run of the day
//   - filter chips     EASY / FLOW / HARD / PRO + "MOJE PB"
//   - TrailRow list    flat rows w/ diff stripe + status pulse + PB
//   - empty / pioneer  unchanged from prior iteration (still works)
//
// Old chunk9 tokens kept ONLY where the inner components require
// them (FilterPill, GlowButton, SegmentLine still import chunk9
// internally). Direct screen styles use the new design-system
// tokens from `@/theme/colors` + `@/theme/typography`.
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
import * as Haptics from 'expo-haptics';
import { Brackets } from '@/components/ui/Brackets';
import { FilterPill } from '@/components/ui/FilterPill';
import { GlowButton } from '@/components/ui/GlowButton';
import { SegmentLine } from '@/components/ui/SegmentLine';
import { BikeParkHeader } from '@/components/ui/BikeParkHeader';
import { TrailRow } from '@/components/ui/TrailRow';
import { HotLapStrip } from '@/components/ui/HotLapStrip';
import { useAuthContext } from '@/hooks/AuthContext';
import { useBikeParkTrails, useDeleteSpot, useSpot } from '@/hooks/useBackend';
import { pickRunDestination } from '@/features/run/pickRunDestination';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type TrailFilter = 'all' | 'easy' | 'flow' | 'tech';
type SpotDisplayState = 'no_trails' | 'all_calibrating' | 'mixed' | 'all_verified';

/**
 * Chunk 10 §4.2 spot display state matrix.
 *
 * Three render branches: pioneer empty when truly zero trails,
 * list + subtle banner when all trails are still in validation,
 * normal list in every other case.
 */
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
  const [filter, setFilter] = useState<TrailFilter>('all');
  const insets = useSafeAreaInsets();

  const { spot, status: spotStatus, refresh: refreshSpot } = useSpot(id ?? null);
  const { trails, refresh: refreshTrails } = useBikeParkTrails(id ?? null, profile?.id);
  const { submit: deleteSpot } = useDeleteSpot();

  const isCurator = profile?.role === 'curator' || profile?.role === 'moderator';
  const spotDisplayState = computeSpotState(trails);

  // Sum active riders across trails so BikeParkHeader's AKTYWNI cell
  // has a number even when spot.activeRidersToday hasn't been backfilled.
  const aggregateActiveRiders = trails.reduce(
    (sum, t) => sum + (t.trail.activeRidersCount ?? 0),
    0,
  );

  const filteredTrails = trails.filter((trail) => {
    if (filter === 'all') return true;
    if (filter === 'easy') return trail.trail.difficulty === 'easy';
    if (filter === 'flow') return trail.trail.type === 'flow';
    if (filter === 'tech') return trail.trail.type === 'tech';
    return true;
  });

  // Hot lap = the trail with the lowest user PB on this spot. Only
  // shows when at least one trail has a PB so the strip isn't a
  // ghost banner on virgin parks.
  const hotLapCandidate = trails
    .filter((t) => t.userData.pbMs)
    .sort((a, b) => (a.userData.pbMs ?? 0) - (b.userData.pbMs ?? 0))[0];

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refreshSpot(), refreshTrails()]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleGoBack() {
    Haptics.selectionAsync().catch(() => undefined);
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
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

  if (spotStatus === 'loading' && !spot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (spotStatus === 'error' && !spot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.centeredState}>
          <Text style={styles.errorTitle}>Bike park nie dojechał</Text>
          <Text style={styles.errorBody}>
            Sprawdź połączenie i spróbuj jeszcze raz.
          </Text>
          <GlowButton label="Spróbuj ponownie" variant="secondary" onPress={refreshSpot} />
        </View>
      </SafeAreaView>
    );
  }

  if (!spot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Bike park nie znaleziony</Text>
          <Pressable onPress={handleGoBack}>
            <Text style={styles.notFoundBack}>← Wróć</Text>
          </Pressable>
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
        {/* ═════ HEADER BAR — back + breadcrumb crumb ═════ */}
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wróć"
            onPress={handleGoBack}
            style={styles.backButton}
          >
            <Text style={styles.backLabel}>←</Text>
          </Pressable>

          <View style={styles.crumb}>
            <Text style={styles.crumbText}>NWD</Text>
            <View style={styles.crumbDot} />
            <Text style={styles.crumbText}>BIKE PARK</Text>
            <View style={styles.crumbDot} />
            <Text style={styles.crumbAccent}>HUB</Text>
          </View>
        </View>

        {/* ═════ PARK IDENTITY + CONDITIONS ═════ */}
        <BikeParkHeader spot={spot} fallbackActiveRiders={aggregateActiveRiders} />

        {/* ═════ HOT LAP — only when there's a real PB ═════ */}
        {hotLapCandidate && hotLapCandidate.userData.pbMs ? (
          <HotLapStrip
            trailName={hotLapCandidate.trail.name}
            riderName="Ty"
            durationMs={hotLapCandidate.userData.pbMs}
            recencyLabel={
              hotLapCandidate.userData.lastRanAt ? 'twój PB' : null
            }
          />
        ) : null}

        {/* ═════ FILTER CHIPS — only when worth filtering ═════ */}
        {trails.length >= 3 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            <FilterPill label="Wszystkie" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterPill label="Easy" active={filter === 'easy'} onPress={() => setFilter('easy')} />
            <FilterPill label="Flow" active={filter === 'flow'} onPress={() => setFilter('flow')} />
            <FilterPill label="Tech" active={filter === 'tech'} onPress={() => setFilter('tech')} />
          </ScrollView>
        ) : null}

        {spotDisplayState !== 'no_trails' ? (
          <>
            {/* Section head — count + "WET" / "OPEN" summary in BPH style */}
            <View style={styles.sheetHead}>
              <Text style={styles.sheetTitle}>Trasy w parku</Text>
              <Text style={styles.sheetCount}>
                <Text style={styles.sheetCountAccent}>
                  {filteredTrails.length === trails.length
                    ? trails.length
                    : `${filteredTrails.length} / ${trails.length}`}
                </Text>
              </Text>
            </View>

            {/* Calibration banner — every trail still pending second run */}
            {spotDisplayState === 'all_calibrating' ? (
              <View style={styles.validationBanner}>
                <Text style={styles.validationBannerText}>
                  Trasy czekają na drugi spójny zjazd Pioniera.
                </Text>
              </View>
            ) : null}

            {/* Flat list of TrailRows */}
            <View style={styles.trailList}>
              {filteredTrails.map((trail) => (
                <TrailRow
                  key={trail.trail.id}
                  {...trail}
                  onPress={() =>
                    router.push(
                      pickRunDestination({
                        trailId: trail.trail.id,
                        spotId: spot.id,
                        trailName: trail.trail.name,
                        calibrationStatus: trail.calibrationStatus,
                        intent:
                          trail.state === 'pioneer'
                          && trail.calibrationStatus === 'fresh_pending_second_run'
                            ? 'ranked'
                            : undefined,
                      }),
                    )
                  }
                />
              ))}
            </View>

            <View style={styles.addTrailRow}>
              <GlowButton
                label="+ Dodaj trasę"
                onPress={() => router.push(`/trail/new?spotId=${spot.id}`)}
                variant="secondary"
              />
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Brackets color="dim" />
            <Text style={styles.emptyEyebrow}>MISSJA OTWARTA · PIONEER SLOT WOLNY</Text>
            <Text style={styles.emptyTitle}>
              Pionieruj.{'\n'}Zdefiniuj linię.{'\n'}Wyzwij innych.
            </Text>

            <View style={styles.howItWorksRow}>
              <View style={styles.howItWorksCell}>
                <Text style={styles.howItWorksIndex}>01</Text>
                <Text style={styles.howItWorksItem}>TELEFON DO KIESZENI</Text>
              </View>
              <View style={styles.howItWorksCell}>
                <Text style={styles.howItWorksIndex}>02</Text>
                <Text style={styles.howItWorksItem}>ZJEDŹ RAZ</Text>
              </View>
              <View style={styles.howItWorksCell}>
                <Text style={styles.howItWorksIndex}>03</Text>
                <Text style={styles.howItWorksItem}>RANKING GOTOWY</Text>
              </View>
            </View>

            <SegmentLine />

            <GlowButton
              label="+ Zostań Pionierem"
              onPress={() => router.push(`/trail/new?spotId=${spot.id}`)}
              variant="primary"
            />
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
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  backButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(7, 9, 10, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backLabel: {
    ...typography.title,
    fontSize: 18,
    lineHeight: 18,
    color: colors.textPrimary,
    marginTop: -2,
  },
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  crumbText: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  crumbAccent: {
    ...typography.micro,
    color: colors.accent,
    fontWeight: '800',
  },
  crumbDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  filtersRow: {
    gap: 10,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
  },
  sheetTitle: {
    ...typography.lead,
    fontSize: 16,
    lineHeight: 16,
    color: colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.32,
    fontWeight: '700',
  },
  sheetCount: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '800',
  },
  sheetCountAccent: {
    color: colors.accent,
    fontWeight: '800',
  },
  validationBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.borderMid,
    backgroundColor: colors.row,
  },
  validationBannerText: {
    ...typography.micro,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textSecondary,
    textAlign: 'center',
    fontWeight: '700',
  },
  trailList: {
    // No vertical gap — TrailRow has its own bottom hairline border.
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addTrailRow: {
    paddingTop: 4,
  },
  emptyState: {
    position: 'relative',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  emptyEyebrow: {
    ...typography.label,
    color: colors.textSecondary,
    paddingRight: 18,
  },
  emptyTitle: {
    ...typography.title,
    color: colors.textPrimary,
  },
  howItWorksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  howItWorksCell: {
    flex: 1,
    gap: 4,
  },
  howItWorksIndex: {
    ...typography.micro,
    color: colors.accent,
    fontWeight: '800',
  },
  howItWorksItem: {
    ...typography.micro,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  deleteLink: {
    alignSelf: 'center',
    paddingTop: 4,
  },
  deleteLinkText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
  },
  notFound: {
    paddingHorizontal: spacing.lg,
    paddingTop: 24,
    gap: 12,
  },
  notFoundText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  notFoundBack: {
    ...typography.label,
    color: colors.textPrimary,
  },
  centeredState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  errorTitle: {
    ...typography.title,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  errorBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
