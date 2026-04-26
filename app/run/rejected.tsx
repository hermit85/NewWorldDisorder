// ═══════════════════════════════════════════════════════════
// /run/rejected — Story 5 weak-signal pioneer rejection.
// Server gates the very first run on any trail because that run
// defines the canonical line for everyone else; noisy GPS would
// bake in a distorted track. Rider retries in better signal; the
// trail stays draft so no one else can claim it in the meantime.
//
// Visual: per design-system § Pattern 6 + § 01 race-state-owns-color
// invalid runs use `colors.danger` (NOT a separate gameHud palette).
// "Errors are facts, not apologies" per voice.md.
// ═══════════════════════════════════════════════════════════

import { useEffect, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Btn, IconGlyph, Pill } from '@/components/nwd';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import * as recordingStore from '@/features/recording/recordingStore';

const REASON_COPY: Record<string, { pill: string; title: string; body: string }> = {
  weak_signal: {
    pill: 'GPS · SŁABY',
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
    router.replace(`/run/recording?trailId=${trailId}&spotId=${spotId}`);
  }, [router, trailId, spotId]);

  const handleBack = useCallback(() => {
    if (trailId) router.replace(`/trail/${trailId}`);
    else router.back();
  }, [router, trailId]);

  const canRetry = Boolean(trailId && spotId);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.centered}>
        <View style={styles.iconWrap}>
          <IconGlyph name="x" size={56} color={colors.danger} />
        </View>
        {/* Pill bakes in alignSelf: 'flex-start' so it sits inline
            in row layouts (leaderboard meta, status strips). On a
            standalone column-centered screen we want it under the X
            icon — override at the call site, the only one that
            needs centering. */}
        <Pill state="invalid" dot size="md" style={{ alignSelf: 'center' }}>{copy.pill}</Pill>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.body}>{copy.body}</Text>
      </View>

      <View style={styles.footer}>
        <Btn
          variant="primary"
          size="lg"
          onPress={handleRetry}
          disabled={!canRetry}
        >
          Spróbuj ponownie
        </Btn>
        <Btn
          variant="ghost"
          size="md"
          onPress={handleBack}
          haptic="light"
        >
          Wróć do trasy
        </Btn>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: 'rgba(255, 71, 87, 0.40)',
    backgroundColor: 'rgba(255, 71, 87, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    ...typography.title,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 28,
    lineHeight: 30,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: -0.28,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: spacing.xs,
  },
  body: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
  },
  footer: {
    paddingHorizontal: spacing.pad,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
});
