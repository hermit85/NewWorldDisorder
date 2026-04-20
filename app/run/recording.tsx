// ═══════════════════════════════════════════════════════════
// /run/recording — active Pioneer recording screen.
// Game-HUD polish pass: dark terrain gradient, neon timer glow,
// finish-line stripes on the STOP CTA, 3-dot GPS strength indicator.
// Chunk 4 scope: UI + state machine only. Finalize is Chunk 5.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Linking, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { spacing, radii } from '@/theme/spacing';
import { hudColors, hudTypography, hudShadows } from '@/theme/gameHud';
import { useGPSRecorder } from '@/features/recording/useGPSRecorder';

// TODO Chunk 5: wire expo-keep-awake (npm install expo-keep-awake) to
// prevent phone auto-lock mid-ride. For Chunk 4 simulator verification
// this is unnecessary; for real field walk-test it is mandatory.

const TERRAIN_GRADIENT: readonly [string, string, string] = [
  hudColors.terrainHigh,
  hudColors.terrainMid,
  hudColors.terrainDark,
];

const DANGER_GRADIENT: readonly [string, string] = [
  hudColors.terrainDark,
  'rgba(255, 67, 101, 0.22)',
];

function formatTimer(ms: number): string {
  const totalMs = Math.max(0, ms);
  const totalSec = Math.floor(totalMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const tenths = Math.floor((totalMs % 1000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${tenths}`;
}

// ── GPS strength: 3 dots, colour per bucket, 1 active per level ──

type GpsStrength = 'strong' | 'medium' | 'weak' | 'unknown';

function gpsStrength(acc: number | null, weakSignal: boolean): GpsStrength {
  if (weakSignal) return 'weak';
  if (acc === null) return 'unknown';
  if (acc <= 5) return 'strong';
  if (acc <= 15) return 'medium';
  return 'weak';
}

function GpsDots({ strength }: { strength: GpsStrength }) {
  const color =
    strength === 'strong' ? hudColors.gpsStrong :
    strength === 'medium' ? hudColors.gpsMedium :
    strength === 'weak'   ? hudColors.gpsWeak   :
    hudColors.gpsMuted;
  const activeCount =
    strength === 'strong' ? 3 :
    strength === 'medium' ? 2 :
    strength === 'weak'   ? 1 : 0;

  return (
    <View style={dotsStyles.row}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            dotsStyles.dot,
            { backgroundColor: i < activeCount ? color : hudColors.gpsMuted },
            i < activeCount && strength !== 'unknown' && {
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

const dotsStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});

// ── Pulse animation hook (for REKORDUJE label) ──

function usePulseAnim(fromOpacity: number, toOpacity: number, durationMs: number) {
  const anim = useRef(new Animated.Value(fromOpacity)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: toOpacity, duration: durationMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: fromOpacity, duration: durationMs, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim, fromOpacity, toOpacity, durationMs]);
  return anim;
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════

export default function RecordingScreen() {
  const { trailId: rawTrailId, spotId: rawSpotId } = useLocalSearchParams<{
    trailId?: string;
    spotId?: string;
  }>();
  const trailId = rawTrailId ?? '';
  const spotId = rawSpotId ?? '';
  const router = useRouter();

  const { state, startCountdown, stopRecording, cancelRecording, extendTimeout } =
    useGPSRecorder({ trailId, spotId });

  const lastCountdownSecondRef = useRef<number | null>(null);
  const lastWeakSignalRef = useRef<boolean>(false);
  const enteredGraceRef = useRef<boolean>(false);
  const stoppedHandledRef = useRef<boolean>(false);
  const prevPhaseRef = useRef<string>('idle');

  const recordingPulse = usePulseAnim(0.4, 0.8, 800);
  const weakPulse = usePulseAnim(0.7, 1, 1000);

  // Countdown scale animation — on every new second bucket, pop number.
  const countdownScale = useRef(new Animated.Value(1)).current;

  // ── Guards ───────────────────────────────────────────────

  useEffect(() => {
    if (!trailId || !spotId) {
      Alert.alert(
        'Brak trasy',
        'Spróbuj ponownie z ekranu trasy.',
        [{ text: 'OK', onPress: () => router.back() }],
      );
    }
  }, [trailId, spotId, router]);

  // ── Auto-start countdown ────────────────────────────────

  useEffect(() => {
    void startCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown haptic + scale pop ────────────────────────

  useEffect(() => {
    if (state.phase !== 'countdown') {
      lastCountdownSecondRef.current = null;
      return;
    }
    const second = Math.ceil(state.remainingMs / 1000);
    if (lastCountdownSecondRef.current !== second) {
      lastCountdownSecondRef.current = second;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      countdownScale.setValue(1.2);
      Animated.timing(countdownScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [state, countdownScale]);

  // ── Countdown → recording transition haptic ─────────────

  useEffect(() => {
    if (prevPhaseRef.current === 'countdown' && state.phase === 'recording') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

  // ── Weak signal edge haptic ─────────────────────────────

  useEffect(() => {
    if (state.phase !== 'recording') return;
    if (state.weakSignal && !lastWeakSignalRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    lastWeakSignalRef.current = state.weakSignal;
  }, [state]);

  // ── Grace entry haptic ──────────────────────────────────

  useEffect(() => {
    if (state.phase === 'timeout_grace' && !enteredGraceRef.current) {
      enteredGraceRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } else if (state.phase !== 'timeout_grace') {
      enteredGraceRef.current = false;
    }
  }, [state.phase]);

  // ── Stopped → route ─────────────────────────────────────

  useEffect(() => {
    if (state.phase !== 'stopped' || stoppedHandledRef.current) return;
    stoppedHandledRef.current = true;

    // TODO Chunk 5: actual finalize flow
    // 1. Build geometry via buildTrailGeometry(state.points, null)
    // 2. Pre-check via validateGeometry
    // 3. If invalid client-side → show error screen, trail stays draft
    // 4. If valid → call api.finalizePioneerRun(...)
    // 5. On success → router.replace(/run/result?runId=...&isPioneer=true)
    // 6. On weak_signal_pioneer → show Story 5 rejection screen
    // 7. On already_pioneered → show "ktoś cię wyprzedził" + retry CTA
    // 8. On other errors → toast + back to trail screen
    // 9. recordingStore.clearBuffer() after success OR user dismissal

    if (state.reason === 'cancel') {
      router.back();
      return;
    }
    const t = setTimeout(() => router.back(), 2000);
    return () => clearTimeout(t);
  }, [state, router]);

  // ── Handlers ─────────────────────────────────────────────

  const handleCancelPress = useCallback(() => {
    Haptics.selectionAsync();
    Alert.alert(
      'Odrzucić nagranie?',
      'Trasa zostanie, ale ten zjazd nie zostanie zapisany.',
      [
        { text: 'Kontynuuj nagrywanie', style: 'cancel' },
        {
          text: 'Odrzuć',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            cancelRecording();
          },
        },
      ],
    );
  }, [cancelRecording]);

  const handleStopPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopRecording();
  }, [stopRecording]);

  const handleExtend = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    extendTimeout();
  }, [extendTimeout]);

  // ── Render ───────────────────────────────────────────────

  const strength =
    state.phase === 'recording'
      ? gpsStrength(state.currentAccuracy, state.weakSignal)
      : 'unknown';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={state.phase === 'timeout_grace' ? DANGER_GRADIENT : TERRAIN_GRADIENT}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* PERMISSION PHASES */}
        {(state.phase === 'permission_requesting' || state.phase === 'permission_denied') && (
          <View style={styles.centered}>
            <View style={styles.lockBox}>
              <Text style={styles.lockGlyph}>⌖</Text>
            </View>
            <Text style={styles.permTitle}>GPS WYMAGANY</Text>
            <Text style={styles.permBody}>
              Nagrywanie trasy wymaga dostępu do lokalizacji.{'\n'}Bez GPS nie wyznaczysz linii.
            </Text>
            {state.phase === 'permission_denied' && (
              <>
                <Pressable style={styles.permCta} onPress={() => Linking.openSettings()}>
                  <Text style={styles.permCtaLabel}>OTWÓRZ USTAWIENIA</Text>
                </Pressable>
                <Pressable style={styles.permCancel} onPress={() => router.back()}>
                  <Text style={styles.permCancelLabel}>ANULUJ</Text>
                </Pressable>
              </>
            )}
          </View>
        )}

        {/* COUNTDOWN */}
        {state.phase === 'countdown' && (
          <View style={styles.centered}>
            <Animated.Text
              style={[styles.countdownNumber, { transform: [{ scale: countdownScale }] }]}
            >
              {Math.max(1, Math.ceil(state.remainingMs / 1000))}
            </Animated.Text>
            <Text style={styles.countdownLabel}>PRZYGOTUJ SIĘ</Text>
          </View>
        )}

        {/* RECORDING */}
        {state.phase === 'recording' && (
          <View style={styles.recordingRoot}>
            <View style={styles.topRow}>
              <View style={styles.gpsBlock}>
                <GpsDots strength={strength} />
                {state.currentAccuracy !== null && (
                  <Text style={styles.gpsLabel}>±{state.currentAccuracy.toFixed(0)} M</Text>
                )}
              </View>

              <Pressable
                style={styles.cancelBtn}
                onPress={handleCancelPress}
                hitSlop={12}
              >
                <Text style={styles.cancelLabel}>ANULUJ</Text>
                <Text style={styles.cancelSubtitle}>ODRZUĆ NAGRANIE</Text>
              </Pressable>
            </View>

            {state.weakSignal && (
              <Animated.View style={[styles.weakBanner, { opacity: weakPulse }]}>
                <Text style={styles.weakBannerText}>⚠ SŁABY SYGNAŁ GPS</Text>
              </Animated.View>
            )}

            <View style={styles.timerWrap}>
              <View style={[styles.timerBox, hudShadows.glowTimer]}>
                <Text style={styles.timerText}>{formatTimer(state.elapsedMs)}</Text>
                <Animated.Text style={[styles.timerSubLabel, { opacity: recordingPulse }]}>
                  ● REKORDUJE
                </Animated.Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.stopCta,
                pressed && { transform: [{ scale: 0.97 }] },
              ]}
              onPress={handleStopPress}
            >
              <View style={styles.finishStripes} pointerEvents="none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.finishStripeCell,
                      { backgroundColor: i % 2 === 0 ? hudColors.terrainDark : hudColors.timerPrimary },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.stopLabel}>ZAKOŃCZ</Text>
              <View style={[styles.finishStripes, styles.finishStripesBottom]} pointerEvents="none">
                {Array.from({ length: 14 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.finishStripeCell,
                      { backgroundColor: i % 2 === 0 ? hudColors.timerPrimary : hudColors.terrainDark },
                    ]}
                  />
                ))}
              </View>
            </Pressable>
          </View>
        )}

        {/* TIMEOUT GRACE */}
        {state.phase === 'timeout_grace' && (
          <View style={styles.centered}>
            <Text style={styles.graceEyebrow}>ZAKOŃCZENIE ZA</Text>
            <Text style={styles.graceCountdown}>
              {Math.max(1, Math.ceil(state.remainingMs / 1000))}
            </Text>
            <Text style={styles.graceBody}>
              Nagrywanie trwa już {30 + state.extensionsUsed * 10} min
            </Text>
            {state.extensionsUsed < 3 && (
              <Pressable
                style={({ pressed }) => [
                  styles.extendCta,
                  pressed && { transform: [{ scale: 0.97 }] },
                ]}
                onPress={handleExtend}
              >
                <Text style={styles.extendLabel}>KONTYNUUJ +10 MIN</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* STOPPED placeholder */}
        {state.phase === 'stopped' && state.reason !== 'cancel' && (
          <View style={styles.centered}>
            <Text style={styles.processingLabel}>PRZETWARZANIE…</Text>
            <Text style={styles.processingHint}>
              {state.points.length} punktów · Chunk 5 handles finalize
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hudColors.terrainDark },
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },

  // Permission
  lockBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: hudColors.gpsStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...hudShadows.glowGreen,
  },
  lockGlyph: { fontSize: 42, color: hudColors.gpsStrong, fontFamily: 'Orbitron_700Bold' },
  permTitle: {
    ...hudTypography.displayLarge,
    fontSize: 36,
    color: hudColors.timerPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  permBody: {
    color: hudColors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    fontSize: 15,
    lineHeight: 22,
  },
  permCta: {
    backgroundColor: hudColors.actionPrimary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  permCtaLabel: {
    ...hudTypography.label,
    fontSize: 13,
    color: hudColors.terrainDark,
    letterSpacing: 3,
  },
  permCancel: { paddingVertical: spacing.md },
  permCancelLabel: { ...hudTypography.labelSmall, color: hudColors.textMuted },

  // Countdown
  countdownNumber: {
    ...hudTypography.displayCountdown,
    color: hudColors.timerPrimary,
  },
  countdownLabel: {
    ...hudTypography.label,
    fontSize: 13,
    color: hudColors.gpsStrong,
    letterSpacing: 6,
    marginTop: spacing.lg,
  },

  // Recording
  recordingRoot: { flex: 1, padding: spacing.xl },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  gpsBlock: { flexDirection: 'column', gap: spacing.xs },
  gpsLabel: {
    ...hudTypography.labelSmall,
    color: hudColors.timerPrimary,
    letterSpacing: 2,
  },
  cancelBtn: { alignItems: 'flex-end' },
  cancelLabel: {
    ...hudTypography.label,
    color: hudColors.actionDanger,
    fontSize: 12,
  },
  cancelSubtitle: {
    ...hudTypography.labelSmall,
    color: hudColors.textMuted,
    fontSize: 8,
    marginTop: 2,
  },

  timerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBox: {
    // Transparent — no bg tint or border, let the glow do the work.
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  timerText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 64,
    letterSpacing: 2,
    color: hudColors.timerPrimary,
    fontVariant: ['tabular-nums'] as any,
    textShadowColor: hudColors.gpsStrong,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  timerSubLabel: {
    fontFamily: 'Orbitron_700Bold',
    color: hudColors.gpsStrong,
    marginTop: spacing.sm,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  weakBanner: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: hudColors.gpsWeak,
    backgroundColor: hudColors.actionDangerBg,
    alignItems: 'center',
  },
  weakBannerText: {
    ...hudTypography.label,
    color: hudColors.gpsWeak,
    fontSize: 12,
    letterSpacing: 3,
  },

  stopCta: {
    marginHorizontal: spacing.lg,
    height: '40%',
    borderRadius: 24,
    backgroundColor: hudColors.actionPrimary,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: hudColors.gpsStrong,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 14,
  },
  finishStripes: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 8,
    flexDirection: 'row',
  },
  finishStripesBottom: {
    top: undefined,
    bottom: 0,
  },
  finishStripeCell: {
    flex: 1,
    height: '100%',
  },
  stopLabel: {
    ...hudTypography.action,
    fontSize: 24,
    color: hudColors.terrainDark,
    letterSpacing: 4,
  },

  // Grace
  graceEyebrow: {
    ...hudTypography.label,
    color: hudColors.gpsWeak,
    letterSpacing: 6,
    marginBottom: spacing.lg,
  },
  graceCountdown: {
    ...hudTypography.displayCountdown,
    fontSize: 140,
    lineHeight: 140,
    color: hudColors.gpsWeak,
    marginBottom: spacing.lg,
  },
  graceBody: {
    color: hudColors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    fontSize: 14,
  },
  extendCta: {
    backgroundColor: hudColors.gpsMedium,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  extendLabel: {
    ...hudTypography.action,
    fontSize: 18,
    color: hudColors.terrainDark,
    letterSpacing: 3,
  },

  // Stopped placeholder
  processingLabel: {
    ...hudTypography.displayLarge,
    fontSize: 32,
    color: hudColors.timerPrimary,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  processingHint: {
    color: hudColors.textMuted,
    fontSize: 12,
  },
});
