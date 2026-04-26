// ─────────────────────────────────────────────────────────────
// Spots tab — bike park list (canonical screens-home.jsx ScreenSpots)
//
// Layout per the canonical reference:
//   PageTitle            kicker "Spoty" + h1 "Bike parki" + sub
//   filter pills         WSZYSTKIE / AKTYWNE / NOWE
//   SpotRow list         44×44 marker · name · region+distance · pill
//   "+ Dodaj bike park"  outline btn
//
// All atoms come from `@/components/nwd`. No chunk9 imports —
// everything reads from the canonical token bag.
// ─────────────────────────────────────────────────────────────
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  AmbientScan,
  Btn,
  PageTitle,
  Pill,
  SpotCard,
  type SpotCardCta,
} from '@/components/nwd';
import { useActiveSpots } from '@/hooks/useBackend';
import type { Spot } from '@/data/types';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type Filter = 'all' | 'active' | 'new';

function spotsLabel(n: number): string {
  if (n === 1) return '1 spot';
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14))
    return `${n} spoty`;
  return `${n} spotów`;
}

function applyFilter(spots: Spot[], filter: Filter): Spot[] {
  if (filter === 'all') return spots;
  if (filter === 'active') return spots.filter((s) => s.status === 'active' && s.trailCount > 0);
  return spots.filter((s) => s.trailCount === 0);
}

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'active', label: 'Aktywne' },
  { id: 'new', label: 'Nowe' },
];

export default function SpotsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { spots, status, refresh } = useActiveSpots();

  const visible = useMemo(() => applyFilter(spots, filter), [spots, filter]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }

  function handleAdd() {
    Haptics.selectionAsync().catch(() => undefined);
    router.push('/spot/new');
  }

  function handleOpen(spot: Spot) {
    router.push(`/spot/${spot.id}`);
  }

  const isEmptyAll = status === 'empty' || (status === 'ok' && spots.length === 0);
  const isEmptyFilter = status === 'ok' && spots.length > 0 && visible.length === 0;
  const isInitialLoading = status === 'loading' && spots.length === 0;

  const activeCount = spots.filter((s) => s.status === 'active' && s.trailCount > 0).length;
  const headerSubtitle = isEmptyAll
    ? null
    : `${spotsLabel(spots.length)} · ${activeCount} aktywne`;

  // Resolve SpotRow status from data shape. The canonical row knows
  // active | new | closed; submission_status='pending' folds to "new"
  // visually with an additional "TWOJE · CZEKA" pill via trailing
  // override (so the rider recognises their own pending submission).
  const renderSpotRow = (spot: Spot) => {
    const isOwnPending = spot.submissionStatus === 'pending';
    const ctaKind: SpotCardCta =
      isOwnPending || spot.trailCount === 0 ? 'pioneer' : 'active';
    return (
      <SpotCard
        key={spot.id}
        spotId={spot.id}
        name={spot.name}
        region={spot.region}
        trailCount={spot.trailCount}
        ridersNow={ctaKind === 'active' ? spot.activeRidersToday : null}
        ridersToday={ctaKind === 'active' ? spot.activeRidersToday : null}
        ctaKind={ctaKind}
        ctaLabel={isOwnPending ? 'Twoje · czeka na curatora' : undefined}
        onPress={() => handleOpen(spot)}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AmbientScan />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <PageTitle
          kicker="Spoty"
          title="Bike parki"
          subtitle={headerSubtitle}
        />

        {!isEmptyAll && !isInitialLoading ? (
          <View style={styles.filterRow}>
            {FILTERS.map((f) => {
              const active = filter === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => undefined);
                    setFilter(f.id);
                  }}
                  style={[
                    styles.filter,
                    active && styles.filterActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.filterLabel,
                      active && styles.filterLabelActive,
                    ]}
                  >
                    {f.label.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {isInitialLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : status === 'error' ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>TRYB AWARYJNY</Text>
            <Text style={styles.emptyBody}>
              Spoty nie dojechały. Spróbuj jeszcze raz.
            </Text>
            <Btn
              variant="ghost"
              size="md"
              fullWidth={false}
              onPress={handleRefresh}
            >
              Spróbuj ponownie
            </Btn>
          </View>
        ) : isEmptyAll ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>BRAK BIKE PARKÓW</Text>
            <Text style={styles.emptyBody}>
              Brak parków w twojej okolicy. Dodaj pierwszy.
            </Text>
            <Btn
              variant="primary"
              size="lg"
              onPress={handleAdd}
            >
              + Dodaj pierwszy bike park
            </Btn>
          </View>
        ) : isEmptyFilter ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>
              Nic w tym filtrze. Wypróbuj inny.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map(renderSpotRow)}
          </View>
        )}

        {!isEmptyAll && status !== 'error' && !isInitialLoading ? (
          <Btn
            variant="primary"
            size="lg"
            onPress={handleAdd}
            style={styles.addCta}
          >
            + Dodaj bike park
          </Btn>
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
  scroll: {
    paddingHorizontal: spacing.pad,
    paddingTop: spacing.pad,
    paddingBottom: 96,
    gap: spacing.lg,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filter: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterActive: {
    backgroundColor: colors.textPrimary,
    borderColor: colors.textPrimary,
  },
  filterLabel: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.8, // 0.18em @ 10
    color: colors.textSecondary,
    fontWeight: '700',
  },
  filterLabelActive: {
    color: colors.bg,
  },
  list: {
    gap: spacing.gap,
  },
  loading: {
    paddingVertical: 64,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 32,
    gap: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    ...typography.label,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.64, // 0.24em @ 11
    textAlign: 'center',
  },
  emptyBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 280,
  },
  addCta: {
    marginTop: 4,
  },
});
