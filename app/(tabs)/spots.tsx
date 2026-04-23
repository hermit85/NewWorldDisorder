// ═══════════════════════════════════════════════════════════
// SPOTY tab — bike park list + add entry point.
//
// Retention question: "gdzie pojadę". One row per bike park,
// simple "X tras · region" meta line, chevron affordance, and
// a permanent + DODAJ BIKE PARK CTA on the bottom. Filter pills
// reflect the only split that matters at this volume: Wszystkie
// vs Aktywne (status='active' AND trailCount>0) vs Nowe
// (trailCount===0 — Pioneer invite waiting).
// ═══════════════════════════════════════════════════════════

import { useMemo, useState } from 'react';
import {
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
import { GlowButton } from '@/components/ui/GlowButton';
import { FilterPill } from '@/components/ui/FilterPill';
import { useActiveSpots } from '@/hooks/useBackend';
import type { Spot } from '@/data/types';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type Filter = 'all' | 'active' | 'new';

function trailsLabel(n: number): string {
  if (n === 1) return '1 trasa';
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} trasy`;
  return `${n} tras`;
}

function spotsLabel(n: number): string {
  if (n === 1) return '1 spot';
  const lastDigit = n % 10;
  const lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} spoty`;
  return `${n} spotów`;
}

function applyFilter(spots: Spot[], filter: Filter): Spot[] {
  if (filter === 'all') return spots;
  if (filter === 'active') return spots.filter((s) => s.status === 'active' && s.trailCount > 0);
  // 'new' = approved but no trails yet — Pioneer invite slot
  return spots.filter((s) => s.trailCount === 0);
}

function SpotRow({ spot, onPress }: { spot: Spot; onPress: () => void }) {
  // Pending rows only reach this list for the submitter (RLS filters
  // other people's drafts). Surface the state explicitly so the rider
  // recognises their own submission-in-flight rather than mistaking
  // it for a fresh pioneer slot open to everyone.
  const isOwnPending = spot.submissionStatus === 'pending';

  const statusLabel = isOwnPending
    ? 'TWOJE · CZEKA'
    : spot.trailCount === 0
      ? 'NOWY'
      : spot.status === 'active'
        ? 'AKTYWNY'
        : spot.status === 'seasonal'
          ? 'SEZONOWY'
          : 'ZAMKNIĘTY';
  const statusTone = isOwnPending
    ? styles.statusPending
    : spot.trailCount === 0
      ? styles.statusNew
      : spot.status === 'active'
        ? styles.statusActive
        : styles.statusMuted;

  const metaLine = isOwnPending
    ? (spot.region ? `${spot.region} · pojedź pioneer run żeby aktywować` : 'Pojedź pioneer run żeby aktywować')
    : spot.trailCount > 0
      ? `${trailsLabel(spot.trailCount)}${spot.region ? ` · ${spot.region}` : ''}`
      : spot.region || 'Czeka na pierwszą trasę';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Otwórz ${spot.name}, ${statusLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.rowTitle} numberOfLines={1}>{spot.name}</Text>
        <Text style={[styles.rowStatus, statusTone]}>{statusLabel}</Text>
        <Text style={styles.chevron}>›</Text>
      </View>
      <Text style={styles.rowMeta} numberOfLines={1}>{metaLine}</Text>
    </Pressable>
  );
}

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
    Haptics.selectionAsync().catch(() => undefined);
    router.push(`/spot/${spot.id}`);
  }

  const isEmptyAll = status === 'empty' || (status === 'ok' && spots.length === 0);
  const isEmptyFilter = status === 'ok' && spots.length > 0 && visible.length === 0;

  const activeCount = spots.filter((s) => s.status === 'active' && s.trailCount > 0).length;
  const headerSubtitle = isEmptyAll
    ? null
    : `${spotsLabel(spots.length)} · ${activeCount} aktywne`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={chunk9Colors.accent.emerald}
          />
        }
      >
        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>SPOTY</Text>
          {headerSubtitle ? (
            <Text style={styles.screenSubtitle}>{headerSubtitle}</Text>
          ) : null}
        </View>

        {isEmptyAll ? null : (
          <View style={styles.filterRow}>
            <FilterPill label="Wszystkie" active={filter === 'all'} onPress={() => setFilter('all')} />
            <FilterPill label="Aktywne" active={filter === 'active'} onPress={() => setFilter('active')} />
            <FilterPill label="Nowe" active={filter === 'new'} onPress={() => setFilter('new')} />
          </View>
        )}

        {status === 'error' ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Tryb awaryjny</Text>
            <Text style={styles.emptyBody}>Spoty nie dojechały. Spróbuj jeszcze raz.</Text>
            <GlowButton label="Spróbuj ponownie" variant="secondary" onPress={handleRefresh} />
          </View>
        ) : isEmptyAll ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Brak bike parków w twojej okolicy.</Text>
            <GlowButton label="+ Dodaj pierwszy bike park" variant="primary" onPress={handleAdd} />
          </View>
        ) : isEmptyFilter ? (
          <View style={styles.empty}>
            <Text style={styles.emptyBody}>Nic w tym filtrze. Wypróbuj inny.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {visible.map((spot) => (
              <SpotRow key={spot.id} spot={spot} onPress={() => handleOpen(spot)} />
            ))}
          </View>
        )}

        {!isEmptyAll && status !== 'error' ? (
          <View style={styles.addCta}>
            <GlowButton label="+ Dodaj bike park" variant="primary" onPress={handleAdd} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: chunk9Colors.bg.base },
  scroll: {
    paddingHorizontal: chunk9Spacing.containerHorizontal,
    paddingTop: chunk9Spacing.sectionVertical,
    paddingBottom: 96,
    gap: chunk9Spacing.sectionVertical,
  },
  screenHeader: {
    gap: 4,
  },
  screenTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    letterSpacing: 4,
  },
  screenSubtitle: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
    letterSpacing: 1.5,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  list: {
    backgroundColor: chunk9Colors.bg.surface,
    borderRadius: chunk9Radii.card,
    paddingHorizontal: 16,
  },
  row: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: chunk9Colors.bg.hairline,
    gap: 4,
  },
  rowPressed: { opacity: 0.7 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowTitle: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.primary,
    fontSize: 16,
    lineHeight: 22,
    flex: 1,
  },
  rowStatus: {
    ...chunk9Typography.captionMono10,
  },
  statusActive: { color: chunk9Colors.accent.emerald },
  statusNew: { color: '#FFB547' },
  statusPending: { color: '#7EE8FA' },
  statusMuted: { color: chunk9Colors.text.tertiary },
  chevron: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.tertiary,
    fontSize: 22,
    lineHeight: 22,
  },
  rowMeta: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  empty: {
    paddingVertical: 32,
    gap: 16,
    alignItems: 'center',
  },
  emptyTitle: {
    ...chunk9Typography.display28,
    color: chunk9Colors.text.primary,
    textAlign: 'center',
  },
  emptyBody: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
    textAlign: 'center',
  },
  addCta: {
    marginTop: 8,
  },
});
