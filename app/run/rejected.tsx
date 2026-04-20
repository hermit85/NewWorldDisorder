// ═══════════════════════════════════════════════════════════
// /run/rejected — Story 5 weak-signal pioneer rejection.
// Server gates the very first run on any trail because that run
// defines the canonical line for everyone else; noisy GPS would
// bake in a distorted track. Rider retries in better signal; the
// trail stays draft so no one else can claim it in the meantime.
// ═══════════════════════════════════════════════════════════

import { useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { spacing, radii } from '@/theme/spacing';
import { hudColors, hudTypography } from '@/theme/gameHud';
import * as recordingStore from '@/features/recording/recordingStore';
import { tapMedium, tapLight } from '@/systems/haptics';

const TERRAIN_GRADIENT: readonly [string, string, string] = [
  hudColors.terrainHigh,
  hudColors.terrainMid,
  hudColors.terrainDark,
];

const REASON_COPY: Record<string, { title: string; body: string }> = {
  weak_signal: {
    title: 'ZJAZD NIEZATWIERDZONY',
    body:
      'Pierwszy zjazd wyznacza linię dla wszystkich riderów. ' +
      'Szum w GPS zniekształciłby kalibrację trasy dla innych. ' +
      'Spróbuj ponownie w lepszym sygnale GPS.',
  },
};

export default function RejectedScreen() {
  const { trailId: rawTrailId, spotId: rawSpotId, reason: rawReason } =
    useLocalSearchParams<{ trailId?: string; spotId?: string; reason?: string }>();
  const trailId = rawTrailId ?? '';
  const spotId = rawSpotId ?? '';
  const reason = rawReason ?? 'weak_signal';
  const router = useRouter();

  const copy = REASON_COPY[reason] ?? REASON_COPY.weak_signal;

  // Discard the failed buffer — the next attempt starts fresh.
  useEffect(() => {
    void recordingStore.clearBuffer();
  }, []);

  const handleRetry = useCallback(() => {
    if (!trailId || !spotId) return;
    tapMedium();
    router.replace(`/run/recording?trailId=${trailId}&spotId=${spotId}`);
  }, [router, trailId, spotId]);

  const handleBack = useCallback(() => {
    tapLight();
    if (trailId) router.replace(`/trail/${trailId}`);
    else router.back();
  }, [router, trailId]);

  const canRetry = Boolean(trailId && spotId);

  return (
    <View style={styles.root}>
      <LinearGradient colors={TERRAIN_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.glyph}>⚠</Text>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>
        </View>

        <View style={styles.footer}>
          <Pressable
            onPress={handleRetry}
            disabled={!canRetry}
            style={({ pressed }) => [
              styles.primaryCta,
              !canRetry && { opacity: 0.3 },
              pressed && canRetry && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.primaryCtaLabel}>SPRÓBUJ PONOWNIE</Text>
          </Pressable>

          <Pressable onPress={handleBack} hitSlop={8} style={styles.secondaryCta}>
            <Text style={styles.secondaryCtaLabel}>WRÓĆ DO TRASY</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hudColors.terrainDark },
  safe: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  glyph: {
    fontSize: 96,
    color: hudColors.gpsWeak,
    marginBottom: spacing.xl,
    textShadowColor: hudColors.gpsWeak,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  title: {
    ...hudTypography.displayLarge,
    fontSize: 28,
    color: hudColors.gpsWeak,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  body: {
    color: hudColors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  primaryCta: {
    backgroundColor: hudColors.actionPrimary,
    borderRadius: radii.lg,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: hudColors.gpsStrong,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  primaryCtaLabel: {
    ...hudTypography.action,
    fontSize: 16,
    color: hudColors.terrainDark,
    letterSpacing: 3,
  },
  secondaryCta: {
    marginTop: spacing.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryCtaLabel: {
    ...hudTypography.label,
    color: hudColors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
  },
});
