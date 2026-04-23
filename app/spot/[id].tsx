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
import { SectionHeader } from '@/components/ui/SectionHeader';
import { SegmentLine } from '@/components/ui/SegmentLine';
import { TrailCard } from '@/components/ui/TrailCard';
import { formatTimeShort } from '@/content/copy';
import { useAuthContext } from '@/hooks/AuthContext';
import { useBikeParkTrails, useDeleteSpot, useSpot } from '@/hooks/useBackend';
import { pickRunDestination } from '@/features/run/pickRunDestination';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type TrailFilter = 'all' | 'easy' | 'flow' | 'tech';
type SpotDisplayState = 'no_trails' | 'all_calibrating' | 'mixed' | 'all_verified';

/**
 * Chunk 10 §4.2 spot display state matrix.
 *
 * Prior to this release the screen treated trails.length === 0 as the
 * only "empty" case and rendered the Pioneer empty card. Walk-test v4
 * caught the corollary bug: a spot with three calibrating trails
 * (Pioneer ran but second rider has not confirmed yet) was NOT empty —
 * the Chunk 9 rewrite showed the list, but the legacy EmptyMapPlaceholder
 * still surfaced "Mapa trasy pojawi się po pierwszym zjeździe Pioniera"
 * which is a lie when geometry already exists.
 *
 * The matrix drives three render branches: pioneer empty when truly
 * zero trails, list + subtle banner when all trails are in validation,
 * normal list in every other case.
 */
function computeSpotState(
  trails: { calibrationStatus?: string }[],
): SpotDisplayState {
  if (trails.length === 0) return 'no_trails';
  const verified = trails.filter((t) => t.calibrationStatus === 'verified').length;
  const calibrating = trails.filter((t) => t.calibrationStatus === 'calibrating').length;
  if (calibrating === trails.length) return 'all_calibrating';
  if (verified === trails.length) return 'all_verified';
  return 'mixed';
}

// Bike park is a detail route (no tab bar), but the bottom CTA "+ Dodaj trasę"
// and destructive curator link must clear the home-indicator area.
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
  const bestPbMs = trails.reduce<number | null>((best, trail) => {
    const pb = trail.userData.pbMs;
    if (!pb) return best;
    if (best === null || pb < best) return pb;
    return best;
  }, null);

  const spotDisplayState = computeSpotState(trails);

  const filteredTrails = trails.filter((trail) => {
    if (filter === 'all') return true;
    if (filter === 'easy') return trail.trail.difficulty === 'easy';
    if (filter === 'flow') return trail.trail.type === 'flow';
    if (filter === 'tech') return trail.trail.type === 'tech';
    return true;
  });

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refreshSpot(), refreshTrails()]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleGoBack() {
    // Spec v2 1.5: nav tap fires haptic.tap
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
          <ActivityIndicator size="large" color={chunk9Colors.accent.emerald} />
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
            tintColor={chunk9Colors.accent.emerald}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Wróć"
            onPress={handleGoBack}
            style={styles.backButton}
          >
            <Text style={styles.backLabel}>←</Text>
          </Pressable>

          <View style={styles.seasonBadge}>
            <Text style={styles.seasonBadgeText}>S01</Text>
          </View>
        </View>

        {/* B3: identity block collapsed. Dropped '✦ BIKE PARK' kicker
            (context is obvious from the route) and the '{status} · TWÓJ
            REKORD' status/PB line in favour of a lowercase one-liner
            'X tras · Rekord Y'. Status is already conveyed by the badge
            per-trail card. */}
        <View style={styles.identityBlock}>
          <Text style={styles.identityTitle}>{spot.name}</Text>
          <Text style={styles.identitySub}>
            {trails.length} {trails.length === 1 ? 'trasa' : trails.length < 5 ? 'trasy' : 'tras'}
            {bestPbMs ? ` · Rekord ${formatTimeShort(bestPbMs)}` : ''}
          </Text>
        </View>

        {/* B3: actions row reduced to one decision: Leaderboard.
            Map access moves to the trail card tap; INFO folds into
            the identity block (future: tappable to open modal). */}
        <View style={styles.actionsRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Otwórz ranking"
            style={styles.actionButton}
            onPress={() => {
              if (filteredTrails[0]) router.push(`/trail/${filteredTrails[0].trail.id}`);
            }}
          >
            <Text style={styles.actionLabel}>LEADERBOARD</Text>
          </Pressable>
        </View>

        {trails.length >= 3 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            {/* B3: counts dropped from filter pills. The number
                reveals itself when the filter is applied. */}
            <FilterPill label="Wszystkie" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterPill label="Easy" active={filter === 'easy'} onPress={() => setFilter('easy')} />
            <FilterPill label="Flow" active={filter === 'flow'} onPress={() => setFilter('flow')} />
            <FilterPill label="Tech" active={filter === 'tech'} onPress={() => setFilter('tech')} />
          </ScrollView>
        ) : null}

        {spotDisplayState !== 'no_trails' ? (
          <>
            {/* Chunk 10 §4.2: subtle banner when every trail is calibrating.
                Trails exist but the leaderboard is frozen until a second
                rider confirms each Pioneer geometry. Previously the screen
                implied "no trails yet" which was a trust-breaking lie. */}
            {spotDisplayState === 'all_calibrating' ? (
              <View style={styles.validationBanner}>
                <Text style={styles.validationBannerText}>
                  Trasy w walidacji — drugi rider potwierdzi geometrię.
                </Text>
              </View>
            ) : null}

            <View>
              <SectionHeader
                label="Trasy"
                glyph="▼"
                glyphColor={chunk9Colors.text.secondary}
                meta={
                  filteredTrails.length === trails.length
                    ? String(trails.length)
                    : `${filteredTrails.length} z ${trails.length}`
                }
                spacingTop="none"
              />
              <View style={styles.listBlock}>
                {filteredTrails.map((trail) => (
                  <TrailCard
                    key={trail.trail.id}
                    {...trail}
                    onPress={() => router.push(`/trail/${trail.trail.id}`)}
                    onCtaPress={() =>
                      router.push(
                        pickRunDestination({
                          trailId: trail.trail.id,
                          spotId: spot.id,
                          trailName: trail.trail.name,
                          calibrationStatus: trail.calibrationStatus,
                        }),
                      )
                    }
                  />
                ))}
              </View>
            </View>

            {/* Secondary "+ Dodaj trasę" only shows when trails already exist.
                Pioneer empty state uses its own primary CTA inside the empty card
                — rendering two add-trail CTAs was confusing in review. */}
            <GlowButton
              label="+ Dodaj trasę"
              onPress={() => router.push(`/trail/new?spotId=${spot.id}`)}
              variant="secondary"
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Brackets color="dim" />
            <Text style={styles.emptyEyebrow}>BRAK ZDEFINIOWANYCH TRAS</Text>
            <Text style={styles.emptyTitle}>
              Pionieruj.{'\n'}Zdefiniuj linię.{'\n'}Wyzwij innych.
            </Text>
            <Text style={styles.emptyBody}>
              Pierwszy verified zjazd rezerwuje pozycję. Telefon do kieszeni, jeden przejazd i
              ranking jest gotowy dla kolejnych riderów.
            </Text>

            <GlowButton
              label="+ Dodaj pierwszą trasę"
              onPress={() => router.push(`/trail/new?spotId=${spot.id}`)}
              variant="primary"
            />

            <SegmentLine />

            <View style={styles.howItWorksRow}>
              <Text style={styles.howItWorksItem}>TELEFON DO KIESZENI</Text>
              <Text style={styles.howItWorksItem}>ZJEDŹ RAZ</Text>
              <Text style={styles.howItWorksItem}>RANKING GOTOWY</Text>
            </View>
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
    backgroundColor: chunk9Colors.bg.base,
  },
  scrollContent: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    gap: chunk9Spacing.sectionVertical,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chunk9Colors.bg.surface,
  },
  backLabel: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    marginTop: -2,
  },
  seasonBadge: {
    borderRadius: chunk9Radii.pill,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: chunk9Colors.bg.surface,
  },
  seasonBadgeText: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.primary,
  },
  identityBlock: {
    gap: 6,
  },
  identityKicker: {
    ...chunk9Typography.label13,
    color: chunk9Colors.accent.emerald,
  },
  identityTitle: {
    ...chunk9Typography.display56,
    color: chunk9Colors.text.primary,
  },
  identitySub: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: chunk9Radii.pill,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.secondary,
    textAlign: 'center',
  },
  filtersRow: {
    gap: 10,
  },
  validationBanner: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: chunk9Radii.pill,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
  },
  validationBannerText: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
    textAlign: 'center',
  },
  listBlock: {
    gap: 12,
  },
  emptyState: {
    position: 'relative',
    gap: chunk9Spacing.cardChildGap,
    borderRadius: chunk9Radii.card,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
    padding: chunk9Spacing.cardPadding,
    overflow: 'hidden',
  },
  emptyEyebrow: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
    paddingRight: 18,
  },
  emptyTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
  },
  emptyBody: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  howItWorksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  howItWorksItem: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
    flex: 1,
  },
  deleteLink: {
    alignSelf: 'center',
    paddingTop: 4,
  },
  deleteLinkText: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.tertiary,
  },
  notFound: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingTop: 24,
    gap: 12,
  },
  notFoundText: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  notFoundBack: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
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
