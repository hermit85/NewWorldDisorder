// ═══════════════════════════════════════════════════════════
// Pending Spots — curator-only queue.
// Riders hitting this URL directly are bounced to home.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { Btn, PageTitle, TopBar } from '@/components/nwd';
import { useAuthContext } from '@/hooks/AuthContext';
import { usePendingSpots } from '@/hooks/useBackend';
import { approveSpot, rejectSpot, PendingSpot } from '@/lib/api';
import { triggerRefresh } from '@/hooks/useRefresh';
import { notifySuccess, notifyWarning, tapMedium } from '@/systems/haptics';

export default function PendingSpotsScreen() {
  const router = useRouter();
  const { profile, user, isAuthenticated } = useAuthContext();
  const role = profile?.role ?? null;
  const { spots, status, refresh } = usePendingSpots(role, user?.id);

  // Gate: unauthenticated → auth, non-curator → home.
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/auth');
      return;
    }
    if (status === 'unauthorized') {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, status]);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TopBar onBack={() => router.back()} title="Kuratorzy" />
        <PageTitle
          kicker="Kolejka"
          title="Bike parki do zatwierdzenia"
          subtitle={status === 'ok' ? `${spots.length} do zatwierdzenia` : null}
        />
      </View>

      {status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}

      {status === 'empty' && (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Brak bike parków w kolejce</Text>
          <Text style={styles.emptyBody}>Wszystko na bieżąco.</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>NIE UDAŁO SIĘ ZAŁADOWAĆ</Text>
          <Btn variant="ghost" size="md" fullWidth={false} onPress={() => refresh()}>
            Ponów
          </Btn>
        </View>
      )}

      {status === 'ok' && (
        <FlatList
          data={spots}
          keyExtractor={(s) => s.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={() => refresh()}
              tintColor={colors.accent}
            />
          }
          renderItem={({ item }) => (
            <PendingCard spot={item} onDone={() => refresh()} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function PendingCard({ spot, onDone }: { spot: PendingSpot; onDone: () => void }) {
  const [mode, setMode] = useState<'idle' | 'rejecting' | 'busy'>('idle');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const doApprove = useCallback(async () => {
    tapMedium();
    setMode('busy');
    setErrorMsg(null);
    const res = await approveSpot(spot.id);
    if (res.ok) {
      notifySuccess();
      triggerRefresh();
      onDone();
    } else {
      notifyWarning();
      setErrorMsg(errorLabel(res.code));
      setMode('idle');
    }
  }, [spot.id, onDone]);

  const doReject = useCallback(async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setErrorMsg('Podaj powód (min 3 znaki).');
      return;
    }
    tapMedium();
    setMode('busy');
    setErrorMsg(null);
    const res = await rejectSpot(spot.id, trimmed);
    if (res.ok) {
      notifySuccess();
      triggerRefresh();
      onDone();
    } else {
      notifyWarning();
      setErrorMsg(errorLabel(res.code));
      setMode('rejecting');
    }
  }, [spot.id, reason, onDone]);

  return (
    <View style={styles.card}>
      <Text style={styles.cardName}>{spot.name}</Text>
      <Text style={styles.cardMeta}>
        {spot.submitterUsername ?? 'anonim'} · {formatRelative(spot.submittedAt)}
      </Text>
      {spot.centerLat != null && spot.centerLng != null && (
        <Text style={styles.cardCoords}>
          {spot.centerLat.toFixed(5)}, {spot.centerLng.toFixed(5)}
        </Text>
      )}

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {mode === 'idle' && (
        <View style={styles.row}>
          <Btn variant="primary" size="md" onPress={doApprove} style={{ flex: 1 }}>
            Zatwierdź
          </Btn>
          <Btn
            variant="danger"
            size="md"
            onPress={() => { setMode('rejecting'); setErrorMsg(null); }}
            style={{ flex: 1 }}
          >
            Odrzuć
          </Btn>
        </View>
      )}

      {mode === 'rejecting' && (
        <View style={{ marginTop: spacing.md, gap: spacing.md }}>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="Powód odrzucenia"
            placeholderTextColor={colors.textTertiary}
            maxLength={200}
            multiline
          />
          <View style={styles.row}>
            <Btn
              variant="ghost"
              size="md"
              onPress={() => { setMode('idle'); setReason(''); setErrorMsg(null); }}
              style={{ flex: 1 }}
            >
              Anuluj
            </Btn>
            <Btn
              variant="danger"
              size="md"
              onPress={doReject}
              style={{ flex: 1 }}
            >
              Odrzuć
            </Btn>
          </View>
        </View>
      )}

      {mode === 'busy' && (
        <View style={{ marginTop: spacing.md, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
    </View>
  );
}

function errorLabel(code: string): string {
  switch (code) {
    case 'not_curator':   return 'Brak uprawnień.';
    case 'not_found':     return 'Bike park już nie istnieje.';
    case 'not_pending':   return 'Ktoś już go obsłużył.';
    case 'reason_too_short': return 'Powód musi mieć min. 3 znaki.';
    default:              return 'Nie udało się zapisać. Spróbuj ponownie.';
  }
}

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMin = Math.round((now - then) / 60_000);
  if (diffMin < 1) return 'teraz';
  if (diffMin < 60) return `${diffMin} min temu`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH} h temu`;
  const diffD = Math.round(diffH / 24);
  return `${diffD} dni temu`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.pad, paddingBottom: spacing.md, gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  emptyTitle: { ...typography.label, fontFamily: 'Inter_700Bold', fontSize: 11, letterSpacing: 2.64, color: colors.textPrimary },
  emptyBody: { ...typography.body, fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  list: { paddingHorizontal: spacing.pad, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.xs,
  },
  cardName: { ...typography.lead, fontFamily: 'Rajdhani_700Bold', fontSize: 18, color: colors.textPrimary, fontWeight: '700', textTransform: 'uppercase' },
  cardMeta: { ...typography.body, fontSize: 12, color: colors.textTertiary },
  cardCoords: { ...typography.body, fontSize: 12, color: colors.textSecondary, fontVariant: ['tabular-nums'] as any },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  reasonInput: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    minHeight: 80,
    ...typography.body,
  },
  error: { ...typography.body, fontSize: 12, color: colors.danger, marginTop: spacing.sm },
});
