// ─────────────────────────────────────────────────────────────
// /(tabs)/spots — Arena Selector.
//
// SPOTY is no longer a "list of bike parks". It's the screen
// where the rider picks an arena to ride. Each card carries a
// *truthful* state derived from the actual trails table, not the
// denormalised `spot.trailCount` (which mapSpot zeros out and was
// the root cause of "0 trasy / PIONEER SLOT WOLNY" lies on parks
// that had a verified trail with the rider's PB).
//
// Pipeline:
//   1. useActiveSpots               → list of spots
//   2. useTrailsForSpots(ids)       → batched trails per spot
//   3. useTablicaSections           → rider's PBs by trail
//   4. deriveSpotArenaState(...)    → per-spot {kind, label, cta}
//   5. SpotArenaCard renders        → one card per spot
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
import { Btn, PageTitle } from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  useActiveSpots,
  useTrailsForSpots,
} from '@/hooks/useBackend';
import { useTablicaSections } from '@/hooks/useTablicaSections';
import {
  deriveSpotArenaState,
  type SpotArenaState,
} from '@/features/spots/arenaState';
import { resolveSpotArenaRoute } from '@/features/spots/route';
import { SpotArenaCard } from '@/components/spots/SpotArenaCard';
import type { Spot, Trail } from '@/data/types';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

type Filter = 'all' | 'active' | 'new';

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Wszystkie' },
  { id: 'active', label: 'Aktywne' },
  { id: 'new', label: 'Nowe' },
];

function spotsLabel(n: number): string {
  if (n === 1) return '1 spot';
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14))
    return `${n} spoty`;
  return `${n} spotów`;
}

function activeTrailsTotalLabel(n: number): string {
  if (n === 1) return '1 trasa aktywna';
  const lastTwo = n % 100;
  const lastOne = n % 10;
  if (lastTwo >= 12 && lastTwo <= 14) return `${n} tras aktywnych`;
  if (lastOne >= 2 && lastOne <= 4) return `${n} trasy aktywne`;
  return `${n} tras aktywnych`;
}

export default function SpotsScreen() {
  const router = useRouter();
  const { profile } = useAuthContext();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const { spots, status, refresh } = useActiveSpots();
  const spotIds = useMemo(() => spots.map((s) => s.id), [spots]);
  const { byId: trailsBySpot, refresh: refreshTrails } = useTrailsForSpots(spotIds);
  const { sections } = useTablicaSections(profile?.id ?? null);

  // Build a flat trailId → userPb lookup once, used by every card's
  // derive() call. Tablica sections already aggregate this server-
  // side (one round-trip), so we get truthful PBs without N+1 fetches.
  const userPbsByTrailId = useMemo(() => {
    const out = new Map<string, number>();
    for (const section of sections) {
      for (const row of section.trails) {
        if (row.userPbMs != null) out.set(row.trail.id, row.userPbMs);
      }
    }
    return out;
  }, [sections]);

  // Per-spot arena state. Derived together so the header counters
  // can sum truthful active-trail totals across all visible spots.
  const arenaBySpot = useMemo(() => {
    const out = new Map<string, SpotArenaState>();
    for (const spot of spots) {
      const trails: Trail[] = trailsBySpot.get(spot.id) ?? [];
      out.set(spot.id, deriveSpotArenaState({ spot, trails, userPbsByTrailId }));
    }
    return out;
  }, [spots, trailsBySpot, userPbsByTrailId]);

  const visible = useMemo(() => {
    if (filter === 'all') return spots;
    if (filter === 'active') {
      return spots.filter((s) => {
        const a = arenaBySpot.get(s.id);
        return a != null && a.activeTrailCount > 0;
      });
    }
    // 'new' = no trails yet (the original "świeży spot" filter).
    return spots.filter((s) => {
      const a = arenaBySpot.get(s.id);
      return a != null && a.totalTrailCount === 0;
    });
  }, [spots, filter, arenaBySpot]);

  const totalActiveTrails = useMemo(() => {
    let sum = 0;
    for (const a of arenaBySpot.values()) sum += a.activeTrailCount;
    return sum;
  }, [arenaBySpot]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([refresh(), refreshTrails()]);
    } finally {
      setRefreshing(false);
    }
  }

  function handleAdd() {
    Haptics.selectionAsync().catch(() => undefined);
    router.push('/spot/new');
  }

  function handleArenaPress(spot: Spot, arena: SpotArenaState) {
    Haptics.selectionAsync().catch(() => undefined);
    const target = resolveSpotArenaRoute(arena, spot.id);
    router.push(target as any);
  }

  const isEmptyAll = status === 'empty' || (status === 'ok' && spots.length === 0);
  const isEmptyFilter = status === 'ok' && spots.length > 0 && visible.length === 0;
  const isInitialLoading = status === 'loading' && spots.length === 0;

  const headerSubtitle = isEmptyAll
    ? null
    : `${spotsLabel(spots.length)} · ${activeTrailsTotalLabel(totalActiveTrails)}`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
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
                  style={[styles.filter, active && styles.filterActive]}
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
            <Btn variant="ghost" size="md" fullWidth={false} onPress={handleRefresh}>
              Spróbuj ponownie
            </Btn>
          </View>
        ) : isEmptyAll ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>BRAK BIKE PARKÓW</Text>
            <Text style={styles.emptyBody}>
              Brak parków w twojej okolicy. Dodaj pierwszy.
            </Text>
            <Btn variant="primary" size="lg" onPress={handleAdd}>
              + Dodaj pierwszy bike park
            </Btn>
          </View>
        ) : isEmptyFilter ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>Nic w tym filtrze. Wypróbuj inny.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((spot) => {
              const arena = arenaBySpot.get(spot.id);
              if (!arena) return null;
              return (
                <SpotArenaCard
                  key={spot.id}
                  label={arena.label}
                  title={arena.title}
                  meta={arena.meta}
                  cta={arena.cta}
                  tone={arena.tone}
                  onPress={() => handleArenaPress(spot, arena)}
                />
              );
            })}
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
    letterSpacing: 1.8,
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
    letterSpacing: 2.64,
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
