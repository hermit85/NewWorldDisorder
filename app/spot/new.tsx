// ═══════════════════════════════════════════════════════════
// Zgłoś spot — rider submits a new spot for curator approval.
// States: gps_pending → ready | manual_entry → submitting →
//         success | error_duplicate | error_network |
//         error_permission_denied
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, StyleSheet, Pressable,
  ActivityIndicator, Linking, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { SPOT_NAME_MIN, SPOT_NAME_MAX } from '@/constants';
import { getCurrentPosition, requestLocationPermission, checkLocationPermission } from '@/systems/gps';
import { submitSpotWithQueue } from '@/services/spotSubmission';
import { triggerRefresh } from '@/hooks/useRefresh';
import { useAuthContext } from '@/hooks/AuthContext';
import { notifySuccess, notifyWarning, tapMedium } from '@/systems/haptics';

type Screen =
  | { kind: 'gps_pending' }
  | { kind: 'ready'; lat: number; lng: number }
  | { kind: 'manual_entry'; lat: string; lng: string }
  | { kind: 'submitting' }
  | { kind: 'success' }
  | { kind: 'error_duplicate'; nearSpotId: string; nearSpotName: string; distanceM: number }
  | { kind: 'error_network' }
  | { kind: 'error_permission_denied' };

export default function NewSpotScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthContext();
  const [screen, setScreen] = useState<Screen>({ kind: 'gps_pending' });
  const [name, setName] = useState('');

  // Redirect unauthenticated users — only authed can submit.
  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth');
  }, [isAuthenticated]);

  // Acquire GPS on mount.
  const acquireGps = useCallback(async () => {
    setScreen({ kind: 'gps_pending' });
    const permission = await checkLocationPermission();
    if (!permission.foreground) {
      const r = await requestLocationPermission();
      if (!r.foreground) {
        setScreen({ kind: 'error_permission_denied' });
        return;
      }
    }
    const pos = await Promise.race([
      getCurrentPosition(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 20_000)),
    ]);
    if (!pos) {
      // Stay on gps_pending; user can retry or switch to manual entry.
      return;
    }
    setScreen({ kind: 'ready', lat: pos.latitude, lng: pos.longitude });
  }, []);

  useEffect(() => {
    void acquireGps();
  }, [acquireGps]);

  const switchToManual = useCallback(() => {
    setScreen((s) => {
      if (s.kind === 'ready') {
        return { kind: 'manual_entry', lat: String(s.lat), lng: String(s.lng) };
      }
      return { kind: 'manual_entry', lat: '', lng: '' };
    });
  }, []);

  const trimmedName = name.trim();
  const nameValid = trimmedName.length >= SPOT_NAME_MIN && trimmedName.length <= SPOT_NAME_MAX;

  const parseManualCoords = (screen: Extract<Screen, { kind: 'manual_entry' }>): { lat: number; lng: number } | null => {
    const latN = Number(screen.lat.replace(',', '.'));
    const lngN = Number(screen.lng.replace(',', '.'));
    if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return null;
    if (latN < -90 || latN > 90) return null;
    if (lngN < -180 || lngN > 180) return null;
    return { lat: latN, lng: lngN };
  };

  const canSubmit =
    nameValid &&
    (screen.kind === 'ready' || (screen.kind === 'manual_entry' && parseManualCoords(screen) !== null));

  const doSubmit = useCallback(async () => {
    if (!canSubmit) return;
    let lat = 0;
    let lng = 0;
    if (screen.kind === 'ready') {
      lat = screen.lat;
      lng = screen.lng;
    } else if (screen.kind === 'manual_entry') {
      const coords = parseManualCoords(screen);
      if (!coords) return;
      lat = coords.lat;
      lng = coords.lng;
    } else {
      return;
    }

    tapMedium();
    setScreen({ kind: 'submitting' });
    const res = await submitSpotWithQueue({ name: trimmedName, lat, lng });

    if (res.ok && res.queued) {
      // Offline-queued — treat as soft success.
      notifyWarning();
      triggerRefresh();
      setScreen({ kind: 'error_network' });
      return;
    }
    if (res.ok) {
      notifySuccess();
      triggerRefresh();
      setScreen({ kind: 'success' });
      setTimeout(() => router.replace('/(tabs)'), 800);
      return;
    }

    // Typed error from RPC
    if (res.code === 'duplicate_nearby') {
      setScreen({
        kind: 'error_duplicate',
        nearSpotId: (res.extra?.nearSpotId as string) ?? '',
        nearSpotName: (res.extra?.nearSpotName as string) ?? '',
        distanceM: (res.extra?.distanceM as number) ?? 0,
      });
      notifyWarning();
      return;
    }
    // Any other coded failure — stay on the form so the rider can retry.
    notifyWarning();
    setScreen(screen.kind === 'ready' ? { kind: 'ready', lat: screen.lat, lng: screen.lng } : screen);
  }, [canSubmit, screen, trimmedName, router]);

  // ── Render ──

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={16}>
              <Text style={styles.backLabel}>← Wróć</Text>
            </Pressable>
            <Text style={styles.title}>ZGŁOŚ SPOT</Text>
          </View>

          {screen.kind === 'gps_pending' && (
            <View style={styles.card}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.cardTitle}>Szukam sygnału…</Text>
              <Text style={styles.cardBody}>Złap GPS, żeby oznaczyć lokalizację spotu.</Text>
              <Pressable onPress={switchToManual} hitSlop={8}>
                <Text style={styles.link}>Ręcznie wpisz lokalizację</Text>
              </Pressable>
            </View>
          )}

          {screen.kind === 'error_permission_denied' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Brak zgody na GPS</Text>
              <Text style={styles.cardBody}>
                Żeby przypiąć spot do mapy potrzebujemy lokalizacji. Możesz też wpisać
                współrzędne ręcznie.
              </Text>
              <Pressable onPress={() => Linking.openSettings()} style={styles.secondaryCta}>
                <Text style={styles.secondaryCtaLabel}>Otwórz ustawienia</Text>
              </Pressable>
              <Pressable onPress={switchToManual} hitSlop={8}>
                <Text style={styles.link}>Wpisz ręcznie</Text>
              </Pressable>
            </View>
          )}

          {(screen.kind === 'ready' || screen.kind === 'manual_entry') && (
            <View style={styles.card}>
              {screen.kind === 'ready' ? (
                <>
                  <Text style={styles.label}>LOKALIZACJA (GPS)</Text>
                  <Text style={styles.coords}>
                    {screen.lat.toFixed(5)}, {screen.lng.toFixed(5)}
                  </Text>
                  <Pressable onPress={switchToManual} hitSlop={8}>
                    <Text style={styles.link}>Użyj innej lokalizacji</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <Text style={styles.label}>LOKALIZACJA (RĘCZNIE)</Text>
                  <View style={styles.coordRow}>
                    <TextInput
                      style={[styles.coordInput, { marginRight: spacing.sm }]}
                      value={screen.lat}
                      onChangeText={(v) => setScreen({ ...screen, lat: v })}
                      placeholder="lat"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      autoCorrect={false}
                    />
                    <TextInput
                      style={styles.coordInput}
                      value={screen.lng}
                      onChangeText={(v) => setScreen({ ...screen, lng: v })}
                      placeholder="lng"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      autoCorrect={false}
                    />
                  </View>
                </>
              )}

              <View style={{ height: spacing.lg }} />

              <Text style={styles.label}>NAZWA SPOTU</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="np. Las Lipowy"
                placeholderTextColor={colors.textTertiary}
                maxLength={SPOT_NAME_MAX}
                autoFocus
              />
              <Text style={styles.hint}>
                {trimmedName.length}/{SPOT_NAME_MAX} znaków
              </Text>
            </View>
          )}

          {screen.kind === 'submitting' && (
            <View style={styles.card}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.cardTitle}>Wysyłam…</Text>
            </View>
          )}

          {screen.kind === 'success' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Zgłoszone ✓</Text>
              <Text style={styles.cardBody}>Spot trafił do kolejki. Dostaniesz znać, gdy kurator go zatwierdzi.</Text>
            </View>
          )}

          {screen.kind === 'error_duplicate' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Podobny spot już istnieje</Text>
              <Text style={styles.cardBody}>
                „{screen.nearSpotName}" — {screen.distanceM} m od twojej lokalizacji.
              </Text>
              <Pressable
                onPress={() => router.replace(`/spot/${screen.nearSpotId}`)}
                style={styles.primaryCta}
              >
                <Text style={styles.primaryCtaLabel}>Otwórz istniejący</Text>
              </Pressable>
            </View>
          )}

          {screen.kind === 'error_network' && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Brak połączenia</Text>
              <Text style={styles.cardBody}>Zapisano na później — wyślemy, gdy wróci sieć.</Text>
              <Pressable onPress={() => router.replace('/(tabs)')} style={styles.primaryCta}>
                <Text style={styles.primaryCtaLabel}>OK</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {(screen.kind === 'ready' || screen.kind === 'manual_entry') && (
          <View style={styles.footer}>
            <Pressable
              onPress={doSubmit}
              disabled={!canSubmit}
              style={[styles.submitCta, !canSubmit && styles.submitCtaDisabled]}
            >
              <Text style={styles.submitLabel}>ZGŁOŚ</Text>
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl },
  header: { marginBottom: spacing.xl },
  back: { alignSelf: 'flex-start', marginBottom: spacing.md },
  backLabel: { ...typography.bodySmall, color: colors.textSecondary },
  title: { ...typography.h1, color: colors.textPrimary, letterSpacing: 4 },
  card: {
    backgroundColor: colors.bgElevated,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  cardTitle: { ...typography.h3, color: colors.textPrimary, marginTop: spacing.sm, marginBottom: spacing.xs },
  cardBody: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  label: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, marginBottom: spacing.xs },
  coords: { ...typography.body, color: colors.textPrimary, marginBottom: spacing.sm, fontVariant: ['tabular-nums'] as any },
  coordRow: { flexDirection: 'row', alignItems: 'center' },
  coordInput: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
  },
  input: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    ...typography.body,
  },
  hint: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.xs, alignSelf: 'flex-end' },
  link: { ...typography.bodySmall, color: colors.accent, marginTop: spacing.md, textDecorationLine: 'underline' },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  submitCta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitCtaDisabled: { opacity: 0.35 },
  submitLabel: { ...typography.cta, color: colors.bg, letterSpacing: 3 },
  primaryCta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  primaryCtaLabel: { ...typography.cta, color: colors.bg, letterSpacing: 2 },
  secondaryCta: {
    backgroundColor: colors.bg,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryCtaLabel: { ...typography.cta, color: colors.textPrimary, letterSpacing: 2 },
});
