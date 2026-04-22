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
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Brackets } from '@/components/ui/Brackets';
import { FilterPill } from '@/components/ui/FilterPill';
import { GlowButton } from '@/components/ui/GlowButton';
import { SegmentLine } from '@/components/ui/SegmentLine';
import { TrailCard } from '@/components/ui/TrailCard';
import { formatTimeShort } from '@/content/copy';
import { useAuthContext } from '@/hooks/AuthContext';
import { useBikeParkTrails, useDeleteSpot, useSpot } from '@/hooks/useBackend';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type TrailFilter = 'all' | 'easy' | 'flow' | 'tech';

function pickSpotStatusLabel(status: string | undefined): string {
  if (status === 'pending') return 'OCZEKUJE';
  if (status === 'rejected') return 'ODRZUCONY';
  return 'AKTYWNY';
}

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TrailFilter>('all');

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

  const filteredTrails = trails.filter((trail) => {
    if (filter === 'all') return true;
    if (filter === 'easy') return trail.trail.difficulty === 'easy';
    if (filter === 'flow') return trail.trail.type === 'flow';
    if (filter === 'tech') return trail.trail.type === 'tech';
    return true;
  });

  const filterCounts = {
    all: trails.length,
    easy: trails.filter((trail) => trail.trail.difficulty === 'easy').length,
    flow: trails.filter((trail) => trail.trail.type === 'flow').length,
    tech: trails.filter((trail) => trail.trail.type === 'tech').length,
  };

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
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={chunk9Colors.accent.emerald}
          />
        }
      >
        <View style={styles.headerRow}>
          <Pressable onPress={handleGoBack} style={styles.backButton}>
            <Text style={styles.backLabel}>←</Text>
          </Pressable>

          <View style={styles.seasonBadge}>
            <Text style={styles.seasonBadgeText}>S01</Text>
          </View>
        </View>

        <View style={styles.identityBlock}>
          <Text style={styles.identityKicker}>✦ BIKE PARK</Text>
          <Text style={styles.identityTitle}>{spot.name}</Text>
          <Text style={styles.identitySub}>
            {trails.length} TRAS · {pickSpotStatusLabel(spot.submissionStatus)} · TWÓJ REKORD{' '}
            {bestPbMs ? formatTimeShort(bestPbMs) : '—'}
          </Text>
        </View>

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionLabel}>MAPA</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            onPress={() => {
              if (filteredTrails[0]) router.push(`/trail/${filteredTrails[0].trail.id}`);
            }}
          >
            <Text style={styles.actionLabel}>LEADERBOARD</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionLabel}>INFO</Text>
          </Pressable>
        </View>

        {trails.length >= 3 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filtersRow}
          >
            <FilterPill
              label="Wszystkie"
              count={filterCounts.all}
              active={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <FilterPill
              label="Easy"
              count={filterCounts.easy}
              active={filter === 'easy'}
              onPress={() => setFilter('easy')}
            />
            <FilterPill
              label="Flow"
              count={filterCounts.flow}
              active={filter === 'flow'}
              onPress={() => setFilter('flow')}
            />
            <FilterPill
              label="Tech"
              count={filterCounts.tech}
              active={filter === 'tech'}
              onPress={() => setFilter('tech')}
            />
          </ScrollView>
        ) : null}

        {trails.length > 0 ? (
          <View style={styles.listBlock}>
            {filteredTrails.map((trail) => (
              <TrailCard
                key={trail.trail.id}
                {...trail}
                onPress={() => router.push(`/trail/${trail.trail.id}`)}
                onCtaPress={() =>
                  router.push({
                    pathname: '/run/active',
                    params: {
                      trailId: trail.trail.id,
                      trailName: trail.trail.name,
                    },
                  })
                }
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Brackets color="dim" />
            <Text style={styles.emptyEyebrow}>BRAK ZDEFINIOWANYCH TRAS</Text>
            <Text style={styles.emptyTitle}>
              PIONIERUJ.{'\n'}ZDEFINIUJ LINIĘ.{'\n'}WYZWIJ INNYCH.
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

        <GlowButton
          label="+ Dodaj trasę"
          onPress={() => router.push(`/trail/new?spotId=${spot.id}`)}
          variant="secondary"
        />

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
    paddingBottom: 40,
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
    gap: 12,
  },
  actionButton: {
    paddingVertical: 4,
  },
  actionLabel: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.secondary,
  },
  filtersRow: {
    gap: 10,
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
});
