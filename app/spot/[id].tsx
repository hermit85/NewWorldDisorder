// ─────────────────────────────────────────────────────────────
// Spot (Bike Park Hub) screen — STATE A · MID SHEET
//
// Visual language: design-system/Bike Park Hub.html STATE A.
// Map canvas as the hero background, floating top HUD with
// check-in pill + park header, FAB START RUN at bottom-right,
// bottom sheet pinned to the lower 60% with hot lap + trail list.
//
// What's here vs design:
//   ✓ Map canvas (stylized SVG: topo + grid + watermark + gondola
//     + difficulty-colored trail paths + active rider blinks +
//     start gate pulse)
//   ✓ Floating "JESTEŚ W PARKU" check-in pill (top hud)
//   ✓ BikeParkHeader — logo + name + region + WARUNKI/TRAS/AKTYWNI
//   ✓ FAB START RUN with locate button + glow
//   ✓ Bottom sheet (fixed mid-height for now) with hot lap strip
//     + filter chips + TrailRow list
//
// What's deferred to later commits:
//   ✗ Real map (Mapbox / MapLibre) wired to GPS — placeholder
//     SVG canvas stands in until Sprint 3 wires geometry.
//   ✗ Sheet drag-to-expand (snap to mid/full) — sheet is fixed
//     at mid until @gorhom/bottom-sheet is added or we build a
//     Reanimated-based sheet.
//   ✗ Tabs (Trasy / Lifty / Wydarzenia) — only Trasy ships now
//     since lifts and events have no data source yet.
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Brackets } from '@/components/ui/Brackets';
import { GlowButton } from '@/components/ui/GlowButton';
import { SegmentLine } from '@/components/ui/SegmentLine';
import { BikeParkHeader } from '@/components/ui/BikeParkHeader';
import { TrailRow } from '@/components/ui/TrailRow';
import { HotLapStrip } from '@/components/ui/HotLapStrip';
import { BikeParkMap } from '@/components/ui/BikeParkMap';
import { CheckInPill } from '@/components/ui/CheckInPill';
import { FabStartRun } from '@/components/ui/FabStartRun';
import { useAuthContext } from '@/hooks/AuthContext';
import { useBikeParkTrails, useDeleteSpot, useSpot } from '@/hooks/useBackend';
import { pickRunDestination } from '@/features/run/pickRunDestination';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type DiffFilter = 'all' | 'easy' | 'flow' | 'hard' | 'pro';
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

function applyDiffFilter(
  trails: ReturnType<typeof useBikeParkTrails>['trails'],
  filter: DiffFilter,
) {
  if (filter === 'all') return trails;
  return trails.filter((t) => {
    const d = (t.trail.difficulty ?? '').toLowerCase();
    const tp = (t.trail.type ?? '').toLowerCase();
    if (filter === 'flow') return tp === 'flow';
    if (filter === 'easy') return d === 'easy';
    if (filter === 'hard') return d === 'hard' || d === 'medium' || d === 'tech';
    if (filter === 'pro') return d === 'expert' || d === 'pro';
    return true;
  });
}

const FILTER_CHIPS: Array<{ id: DiffFilter; label: string; tone: 'all' | 'green' | 'blue' | 'red' | 'black' }> = [
  { id: 'all', label: 'WSZYSTKIE', tone: 'all' },
  { id: 'easy', label: 'EASY', tone: 'green' },
  { id: 'flow', label: 'FLOW', tone: 'blue' },
  { id: 'hard', label: 'HARD', tone: 'red' },
  { id: 'pro', label: 'PRO', tone: 'black' },
];

const TONE_CHIP: Record<'all' | 'green' | 'blue' | 'red' | 'black', { color: string; border: string }> = {
  all: { color: colors.textSecondary, border: colors.border },
  green: { color: colors.diffGreen, border: 'rgba(60, 203, 127, 0.40)' },
  blue: { color: colors.diffBlue, border: 'rgba(59, 156, 255, 0.40)' },
  red: { color: colors.diffRed, border: 'rgba(255, 71, 87, 0.40)' },
  black: { color: colors.textPrimary, border: 'rgba(255, 255, 255, 0.20)' },
};

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuthContext();
  const [filter, setFilter] = useState<DiffFilter>('all');
  const insets = useSafeAreaInsets();

  const { spot, status: spotStatus, refresh: refreshSpot } = useSpot(id ?? null);
  const { trails } = useBikeParkTrails(id ?? null, profile?.id);
  const { submit: deleteSpot } = useDeleteSpot();

  const isCurator = profile?.role === 'curator' || profile?.role === 'moderator';
  const spotDisplayState = computeSpotState(trails);

  // Sum active riders across trails so BikeParkHeader's AKTYWNI cell
  // has a number even when spot.activeRidersToday hasn't been backfilled.
  const aggregateActiveRiders = trails.reduce(
    (sum, t) => sum + (t.trail.activeRidersCount ?? 0),
    0,
  );

  const filteredTrails = useMemo(
    () => applyDiffFilter(trails, filter),
    [trails, filter],
  );

  // Hot lap = trail with the lowest user PB on this spot.
  const hotLapCandidate = useMemo(
    () =>
      trails
        .filter((t) => t.userData.pbMs)
        .sort((a, b) => (a.userData.pbMs ?? 0) - (b.userData.pbMs ?? 0))[0],
    [trails],
  );

  // Map needs a slim trail list shape — id, name, difficulty, type only.
  const mapTrails = useMemo(
    () =>
      trails.map((t) => ({
        id: t.trail.id,
        name: t.trail.name,
        difficulty: t.trail.difficulty,
        type: t.trail.type,
      })),
    [trails],
  );

  function handleGoBack() {
    Haptics.selectionAsync().catch(() => undefined);
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
  }

  function handleStartRun() {
    if (!spot) return;
    // Pick the first non-locked trail as the default start. The user
    // can also tap any trail row to start that specific one.
    const target = filteredTrails.find(
      (t) => t.calibrationStatus !== 'locked',
    ) ?? filteredTrails[0];
    if (!target) return;
    router.push(
      pickRunDestination({
        trailId: target.trail.id,
        spotId: spot.id,
        trailName: target.trail.name,
        calibrationStatus: target.calibrationStatus,
      }),
    );
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

  // Empty state — pioneer pitch. Render full-screen, no map background.
  if (spotDisplayState === 'no_trails') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
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

        <ScrollView contentContainerStyle={styles.emptyScroll}>
          <BikeParkHeader spot={spot} fallbackActiveRiders={aggregateActiveRiders} />
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

          {isCurator ? (
            <Pressable onPress={handleDeleteSpot} style={styles.deleteLink}>
              <Text style={styles.deleteLinkText}>Usuń ten bike park</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── Active state: layered Bike Park Hub ──────────────────
  return (
    <View style={styles.container}>
      {/* Layer 0 — map canvas (full-screen behind everything). */}
      <BikeParkMap
        trails={mapTrails}
        parkName={spot.name}
        activeRiders={Math.max(2, Math.min(6, aggregateActiveRiders))}
      />

      {/* Layer 1 — top HUD (back button + check-in pill).
          Sits above the map, below the sheet. */}
      <SafeAreaView edges={['top']} pointerEvents="box-none" style={styles.topHudWrap}>
        <View style={styles.topHud} pointerEvents="box-none">
          <View style={styles.topRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wróć"
              onPress={handleGoBack}
              style={styles.backButtonFloat}
            >
              <Text style={styles.backLabel}>←</Text>
            </Pressable>

            <CheckInPill
              variant="armed"
              label="JESTEŚ W PARKU"
              sub={spot.activeRidersToday > 0 ? 'TY + EKIPA' : null}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </SafeAreaView>

      {/* Layer 3 — bottom sheet (fixed mid-height).
          On phones the sheet is ~520-580 px from the bottom which leaves
          enough map visible at top. The interior scrolls. */}
      <View
        style={[styles.sheet, { paddingBottom: insets.bottom }]}
      >
        <View style={styles.sheetHandle} />

        <View style={styles.sheetHeadRow}>
          <BikeParkHeader spot={spot} fallbackActiveRiders={aggregateActiveRiders} />
        </View>

        <View style={styles.sheetTitleRow}>
          <Text style={styles.sheetTitle}>Trasy w parku</Text>
          <Text style={styles.sheetCount}>
            <Text style={styles.sheetCountAccent}>
              {filteredTrails.length === trails.length
                ? trails.length
                : `${filteredTrails.length} / ${trails.length}`}
            </Text>
          </Text>
        </View>

        {trails.length >= 3 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {FILTER_CHIPS.map((chip) => {
              const isActive = filter === chip.id;
              const tone = TONE_CHIP[chip.tone];
              return (
                <Pressable
                  key={chip.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    setFilter(chip.id);
                  }}
                  style={[
                    styles.filter,
                    {
                      borderColor: isActive ? colors.accent : tone.border,
                      backgroundColor: isActive ? colors.accent : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      { color: isActive ? colors.accentInk : tone.color },
                    ]}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {hotLapCandidate && hotLapCandidate.userData.pbMs ? (
          <HotLapStrip
            trailName={hotLapCandidate.trail.name}
            riderName="Ty"
            durationMs={hotLapCandidate.userData.pbMs}
            recencyLabel={hotLapCandidate.userData.lastRanAt ? 'twój PB' : null}
          />
        ) : null}

        {spotDisplayState === 'all_calibrating' ? (
          <View style={styles.validationBanner}>
            <Text style={styles.validationBannerText}>
              Trasy czekają na drugi spójny zjazd Pioniera.
            </Text>
          </View>
        ) : null}

        <ScrollView
          style={styles.trailScroll}
          contentContainerStyle={styles.trailScrollContent}
          showsVerticalScrollIndicator={false}
        >
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

          <View style={styles.addTrailRow}>
            <GlowButton
              label="+ Dodaj trasę"
              onPress={() => router.push(`/trail/new?spotId=${spot.id}`)}
              variant="secondary"
            />
          </View>

          {isCurator ? (
            <Pressable onPress={handleDeleteSpot} style={styles.deleteLink}>
              <Text style={styles.deleteLinkText}>Usuń ten bike park</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </View>

      {/* FAB START RUN — rendered AFTER the sheet so RN paint order
          puts it on top regardless of zIndex. Sheet is `height: '62%'`
          → its top edge is at 62% from screen bottom. We park the FAB
          at 64% so it floats over the map with a small gap above the
          sheet handle. zIndex 36 outranks the sheet's 35 as a defense
          if render order ever changes. */}
      <FabStartRun
        onStart={handleStartRun}
        enabled={filteredTrails.length > 0}
        style={{ bottom: '64%' as any, zIndex: 36 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Loading / error / 404 ----------------------------------------------------
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

  // Empty state shell --------------------------------------------------------
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
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

  emptyScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: 64,
    gap: spacing.lg,
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

  // Top HUD layer ------------------------------------------------------------
  topHudWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
  },
  topHud: {
    paddingHorizontal: 14,
    paddingTop: 6,
    gap: 8,
  },
  topRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  backButtonFloat: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(7, 9, 10, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // FAB positioning lives inline at the call site (above the bottom
  // sheet's top edge). The fabLayer wrapper used to sit here but is
  // now redundant — FabStartRun is itself absolutely positioned.

  // Bottom sheet -------------------------------------------------------------
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '62%',
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.borderHot,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -20 },
    shadowOpacity: 0.8,
    shadowRadius: 60,
    elevation: 24,
    zIndex: 35,
    overflow: 'hidden',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderMid,
    marginTop: 8,
    marginBottom: 6,
  },
  sheetHeadRow: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
  filtersRow: {
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filter: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderWidth: 1,
  },
  filterLabel: {
    ...typography.micro,
    fontSize: 9,
    letterSpacing: 1.98, // 0.22em @ 9px
    fontWeight: '800',
  },
  validationBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderMid,
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
  trailScroll: {
    flex: 1,
  },
  trailScrollContent: {
    paddingBottom: 24,
  },
  addTrailRow: {
    paddingTop: 14,
    paddingHorizontal: 14,
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
