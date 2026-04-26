// ═══════════════════════════════════════════════════════════
// /admin/queue — ADR-012 Phase 4.4 review queue inbox
//
// Curator/moderator-only. Lists pending route_review_queue
// entries with severity-sorted ordering and one-tap resolve
// (approve / reject). Merge proposals deeplink into the source
// trail and let the curator finish the merge in trail/[id]
// (Phase 4.5 will surface the explicit "merge into ..." dialog
// there; for MVP the curator manually picks the target via
// merge_trails RPC).
//
// RLS on route_review_queue is curator-only at the row level,
// so a non-curator hitting this screen sees an empty list (and
// the resolve / merge RPCs would 'forbidden' anyway).
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Btn, PageTitle, Pill, SectionHead, TopBar } from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  fetchReviewQueue,
  resolveReviewQueueEntry,
  type RouteReviewQueueEntry,
} from '@/lib/api';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { notifySuccess, notifyWarning, tapLight, tapMedium } from '@/systems/haptics';

const REASON_LABELS: Record<RouteReviewQueueEntry['reason'], string> = {
  overlap_conflict: 'Konflikt geometrii',
  shortcut_detected: 'Skrót w linii',
  low_confidence_cluster: 'Trasa bez potwierdzeń',
  rider_dispute: 'Spór ridera',
  name_collision: 'Kolizja nazwy',
  merge_proposal: 'Propozycja scalenia',
};

const REASON_BLURB: Record<RouteReviewQueueEntry['reason'], string> = {
  overlap_conflict:
    'Linia ridera pokrywa się 60–85% z istniejącą trasą — albo to wariant, albo duplikat.',
  shortcut_detected:
    'Kandydat na korektę skraca dystans poniżej 95%. Mogło być optymalizacją albo cięciem przez krzaki.',
  low_confidence_cluster:
    '30+ dni bez crowd auto-verify. Track B nudge — zatwierdź jeśli linia wygląda OK.',
  rider_dispute: 'Rider zgłosił że linia jest błędna.',
  name_collision: 'Dwie trasy z tą samą bazową nazwą — może warto scalić.',
  merge_proposal: 'Scalenie zaproponowane manualnie.',
};

function severityState(s: RouteReviewQueueEntry['severity']): 'pending' | 'invalid' | 'neutral' {
  if (s === 'high') return 'invalid';
  if (s === 'normal') return 'pending';
  return 'neutral';
}

export default function ReviewQueueScreen() {
  const router = useRouter();
  const { profile, isAuthenticated } = useAuthContext();
  const [entries, setEntries] = useState<RouteReviewQueueEntry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error' | 'forbidden'>('loading');
  const [refreshing, setRefreshing] = useState(false);

  // profile from AuthContext is the raw Profile row (role: string).
  // useProfile would give a transformed User without `role`.
  const isCurator = profile?.role === 'curator' || profile?.role === 'moderator';

  const load = useCallback(async () => {
    if (!isCurator) {
      setStatus('forbidden');
      return;
    }
    const result = await fetchReviewQueue('pending');
    if (!result.ok) {
      setStatus('error');
      setEntries([]);
      return;
    }
    setEntries(result.data);
    setStatus(result.data.length === 0 ? 'empty' : 'ok');
  }, [isCurator]);

  useEffect(() => {
    if (isAuthenticated && profile) {
      void load();
    }
  }, [isAuthenticated, profile, load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const handleAction = useCallback(
    async (entry: RouteReviewQueueEntry, action: 'approve' | 'reject') => {
      tapMedium();
      const result = await resolveReviewQueueEntry(entry.id, action);
      if (result.ok) {
        notifySuccess();
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      } else {
        notifyWarning();
        Alert.alert('Nie udało się', result.message ?? `Code: ${result.code}`);
      }
    },
    [],
  );

  const handleOpenTrail = useCallback(
    (trailId: string) => {
      tapLight();
      router.push({ pathname: '/trail/[id]', params: { id: trailId } });
    },
    [router],
  );

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <TopBar onBack={() => router.back()} />
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Wymaga logowania.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TopBar
          onBack={() => router.back()}
          trailing={status === 'ok' ? <Pill state="pending" size="sm">{`${entries.length} pending`}</Pill> : null}
        />
        <PageTitle
          kicker="Curator"
          title="Kolejka recenzji"
          subtitle="Konflikty geometrii, skróty, spory — decyzje wymagane."
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {status === 'loading' ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.emptyText}>Ładuję kolejkę…</Text>
          </View>
        ) : status === 'forbidden' ? (
          <View style={styles.centered}>
            <SectionHead label="Brak dostępu" />
            <Text style={styles.emptyText}>
              Kolejka recenzji jest dostępna tylko dla kuratorów i moderatorów.
            </Text>
          </View>
        ) : status === 'error' ? (
          <View style={styles.centered}>
            <Text style={styles.emptyText}>Nie udało się załadować. Przesuń w dół żeby spróbować ponownie.</Text>
          </View>
        ) : status === 'empty' ? (
          <View style={styles.centered}>
            <SectionHead label="Pusto" />
            <Text style={styles.emptyText}>Nic nie czeka na decyzję. Wszystko obsłużone.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {entries.map((entry) => (
              <QueueCard
                key={entry.id}
                entry={entry}
                onApprove={() => handleAction(entry, 'approve')}
                onReject={() => handleAction(entry, 'reject')}
                onOpenTrail={() => handleOpenTrail(entry.trailId)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function QueueCard({
  entry,
  onApprove,
  onReject,
  onOpenTrail,
}: {
  entry: RouteReviewQueueEntry;
  onApprove: () => void;
  onReject: () => void;
  onOpenTrail: () => void;
}) {
  const reasonLabel = REASON_LABELS[entry.reason] ?? entry.reason;
  const reasonBlurb = REASON_BLURB[entry.reason] ?? '';

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {entry.trailName ?? entry.trailId}
          </Text>
          <Text style={styles.cardSubtitle}>{reasonLabel}</Text>
        </View>
        <Pill state={severityState(entry.severity)} size="sm">
          {entry.severity.toUpperCase()}
        </Pill>
      </View>

      <Text style={styles.cardBody}>{reasonBlurb}</Text>

      {entry.details ? <DetailsBlock details={entry.details} /> : null}

      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <Btn variant="ghost" size="sm" onPress={onOpenTrail}>
            Otwórz trasę
          </Btn>
        </View>
      </View>

      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <Btn variant="primary" size="sm" onPress={onApprove}>
            Zatwierdź
          </Btn>
        </View>
        <View style={{ width: 12 }} />
        <View style={{ flex: 1 }}>
          <Btn variant="danger" size="sm" onPress={onReject}>
            Odrzuć
          </Btn>
        </View>
      </View>
    </View>
  );
}

function DetailsBlock({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details).slice(0, 6);
  if (entries.length === 0) return null;
  return (
    <View style={styles.detailsBlock}>
      {entries.map(([k, v]) => (
        <View key={k} style={styles.detailsRow}>
          <Text style={styles.detailsKey}>{k}</Text>
          <Text style={styles.detailsValue} numberOfLines={1}>
            {typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.pad, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: 12 },
  scroll: { paddingHorizontal: spacing.pad, paddingBottom: spacing.xxl, gap: 12 },
  list: { gap: 12 },
  centered: { paddingVertical: spacing.huge, alignItems: 'center', gap: spacing.sm },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  cardTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 20,
    lineHeight: 24,
    color: colors.textPrimary,
  },
  cardSubtitle: {
    ...typography.label,
    color: colors.accent,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  detailsBlock: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    gap: 4,
    marginTop: 4,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailsKey: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    minWidth: 120,
  },
  detailsValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    flex: 1,
    flexShrink: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
});
