// ═══════════════════════════════════════════════════════════
// Pending Spots — curator-only queue.
// Riders hitting this URL directly are bounced to home.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable,
  TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
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
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={16}>
          <Text style={styles.backLabel}>← Wróć</Text>
        </Pressable>
        <Text style={styles.title}>KOLEJKA BIKE PARKÓW</Text>
        {status === 'ok' && (
          <Text style={styles.subtitle}>{spots.length} do zatwierdzenia</Text>
        )}
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
          <Text style={styles.emptyTitle}>Nie udało się załadować</Text>
          <Pressable onPress={() => refresh()} style={styles.retryCta}>
            <Text style={styles.retryLabel}>Ponów</Text>
          </Pressable>
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
          <Pressable onPress={doApprove} style={[styles.cta, styles.ctaApprove]}>
            <Text style={styles.ctaApproveLabel}>ZATWIERDŹ</Text>
          </Pressable>
          <Pressable
            onPress={() => { setMode('rejecting'); setErrorMsg(null); }}
            style={[styles.cta, styles.ctaReject]}
          >
            <Text style={styles.ctaRejectLabel}>ODRZUĆ</Text>
          </Pressable>
        </View>
      )}

      {mode === 'rejecting' && (
        <View style={{ marginTop: spacing.md }}>
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
            <Pressable
              onPress={() => { setMode('idle'); setReason(''); setErrorMsg(null); }}
              style={[styles.cta, styles.ctaGhost]}
            >
              <Text style={styles.ctaGhostLabel}>Anuluj</Text>
            </Pressable>
            <Pressable onPress={doReject} style={[styles.cta, styles.ctaReject]}>
              <Text style={styles.ctaRejectLabel}>ODRZUĆ</Text>
            </Pressable>
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
  header: { padding: spacing.xl, paddingBottom: spacing.md },
  back: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backLabel: { ...typography.bodySmall, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary, letterSpacing: 4 },
  subtitle: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { ...typography.h3, color: colors.textPrimary, marginBottom: spacing.xs },
  emptyBody: { ...typography.body, color: colors.textSecondary },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardName: { ...typography.h3, color: colors.textPrimary },
  cardMeta: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.xs },
  cardCoords: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xs, fontVariant: ['tabular-nums'] as any },
  row: { flexDirection: 'row', marginTop: spacing.md },
  cta: { flex: 1, paddingVertical: spacing.md, alignItems: 'center', borderRadius: radii.md, marginRight: spacing.sm },
  ctaApprove: { backgroundColor: colors.accent },
  ctaApproveLabel: { ...typography.cta, color: colors.bg, letterSpacing: 2 },
  ctaReject: { backgroundColor: colors.redDim, borderWidth: 1, borderColor: colors.red },
  ctaRejectLabel: { ...typography.cta, color: colors.red, letterSpacing: 2 },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  ctaGhostLabel: { ...typography.cta, color: colors.textSecondary, letterSpacing: 2 },
  reasonInput: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    color: colors.textPrimary,
    minHeight: 80,
    ...typography.input,
  },
  error: { ...typography.bodySmall, color: colors.red, marginTop: spacing.sm },
  retryCta: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, paddingVertical: spacing.md, backgroundColor: colors.bgElevated, borderRadius: radii.md },
  retryLabel: { ...typography.cta, color: colors.textPrimary, letterSpacing: 2 },
});
