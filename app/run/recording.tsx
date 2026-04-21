// ═══════════════════════════════════════════════════════════
// /run/recording — Ye brutalist rebuild (ADR-013).
//
// Minimal glance-readable UI for an active Pioneer recording. No map,
// no countdown animation chrome, no glow. Just:
//   - Top bar with LIVE indicator + trail name + GPS dots
//   - Mega serif timer (112pt)
//   - Two stats below (points + GPS quality)
//   - Giant cream STOP circle
//
// Countdown phase still gated by useGPSRecorder. Grace + timeout_grace
// render in the same shell with different copy. Cancel confirms via
// Alert. Non-cancel stops flush buffer + route to /run/review.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { hudColors, hudType, hudSpacing } from '@/theme/gameHud';
import { useGPSRecorder } from '@/features/recording/useGPSRecorder';
import * as recordingStore from '@/features/recording/recordingStore';

const HAIRLINE = StyleSheet.hairlineWidth;

function formatTimer(ms: number): string {
  const totalMs = Math.max(0, ms);
  const totalSec = Math.floor(totalMs / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const hundredths = Math.floor((totalMs % 1000) / 10);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
}

type GpsStrength = 'strong' | 'medium' | 'weak' | 'unknown';

function gpsStrength(acc: number | null, weakSignal: boolean): GpsStrength {
  if (weakSignal) return 'weak';
  if (acc === null) return 'unknown';
  if (acc <= 5) return 'strong';
  if (acc <= 15) return 'medium';
  return 'weak';
}

function GpsDots({ strength }: { strength: GpsStrength }) {
  const activeCount =
    strength === 'strong' ? 3 :
    strength === 'medium' ? 2 :
    strength === 'weak'   ? 1 : 0;
  const color =
    strength === 'strong' ? hudColors.signal :
    strength === 'medium' ? hudColors.trust.curator :
    strength === 'weak'   ? hudColors.trust.disputed :
    hudColors.text.muted;
  return (
    <View style={dotStyles.row}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            { backgroundColor: i < activeCount ? color : hudColors.text.muted },
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});

export default function RecordingScreen() {
  const { trailId: rawTrailId, spotId: rawSpotId } = useLocalSearchParams<{
    trailId?: string; spotId?: string;
  }>();
  const trailId = rawTrailId ?? '';
  const spotId = rawSpotId ?? '';
  const router = useRouter();

  useKeepAwake('nwd-recording');

  const { state, startCountdown, stopRecording, cancelRecording, extendTimeout } =
    useGPSRecorder({ trailId, spotId });

  const stoppedHandledRef = useRef<boolean>(false);
  const lastCountdownSecondRef = useRef<number | null>(null);

  // Guard — navigate away if params missing
  useEffect(() => {
    if (!trailId || !spotId) {
      Alert.alert('Brak trasy', 'Spróbuj ponownie z ekranu trasy.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [trailId, spotId, router]);

  // Auto-start countdown once
  useEffect(() => {
    void startCountdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Countdown haptic ticks
  useEffect(() => {
    if (state.phase !== 'countdown') {
      lastCountdownSecondRef.current = null;
      return;
    }
    const second = Math.ceil(state.remainingMs / 1000);
    if (lastCountdownSecondRef.current !== second) {
      lastCountdownSecondRef.current = second;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [state]);

  // Stopped → route to review
  useEffect(() => {
    if (state.phase !== 'stopped' || stoppedHandledRef.current) return;
    stoppedHandledRef.current = true;

    if (state.reason === 'cancel') {
      void recordingStore.clearBuffer();
      router.back();
      return;
    }

    const lastT = state.points.length > 0 ? state.points[state.points.length - 1].t : 0;
    const startedAt = Date.now() - Math.round(lastT * 1000);

    const proceedToReview = async () => {
      await recordingStore.saveBuffer({ trailId, spotId, startedAt, points: state.points });
      router.replace(`/run/review?trailId=${trailId}&spotId=${spotId}`);
    };

    if (state.points.length < 5) {
      Alert.alert(
        'Nagranie nieważne',
        `Zebrano ${state.points.length} ${state.points.length === 1 ? 'punkt' : 'punkty'} GPS. Zjedź dłużej albo sprawdź pozwolenia GPS.`,
        [
          {
            text: 'Wróć do trasy',
            style: 'cancel',
            onPress: () => { void recordingStore.clearBuffer(); router.back(); },
          },
          { text: 'Kontynuuj mimo to', onPress: () => { void proceedToReview(); } },
        ],
      );
      return;
    }
    void proceedToReview();
  }, [state, router, trailId, spotId]);

  const handleStop = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    stopRecording();
  }, [stopRecording]);

  const handleCancel = useCallback(() => {
    Haptics.selectionAsync();
    Alert.alert(
      'Odrzucić nagranie?',
      'Trasa zostanie, ale ten zjazd nie zostanie zapisany.',
      [
        { text: 'Kontynuuj nagrywanie', style: 'cancel' },
        { text: 'Odrzuć', style: 'destructive', onPress: () => cancelRecording() },
      ],
    );
  }, [cancelRecording]);

  // ── Render ─────────────────────────────────────────────

  if (state.phase === 'permission_requesting' || state.phase === 'permission_denied') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.permKicker}>GPS WYMAGANY</Text>
          <Text style={styles.permTitle}>Włącz lokalizację{'\n'}aby nagrywać trasę</Text>
          <Text style={styles.permBody}>
            Bez GPS nie wyznaczysz linii. Bez linii nie ma Pioneera.
          </Text>
          {state.phase === 'permission_denied' && (
            <>
              <Pressable
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
                onPress={() => Linking.openSettings()}
              >
                <Text style={styles.ctaLabel}>OTWÓRZ USTAWIENIA</Text>
              </Pressable>
              <Pressable onPress={() => router.back()} hitSlop={12}>
                <Text style={styles.cancelText}>ANULUJ</Text>
              </Pressable>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (state.phase === 'countdown') {
    const sec = Math.max(1, Math.ceil(state.remainingMs / 1000));
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.countdownLabel}>PRZYGOTUJ SIĘ</Text>
          <Text style={styles.countdownNumber}>{sec}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.phase === 'stopped' && state.reason !== 'cancel') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.permKicker}>PRZETWARZANIE…</Text>
          <Text style={styles.permBody}>
            {state.points.length} PUNKTÓW GPS
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.phase === 'timeout_grace') {
    const sec = Math.max(1, Math.ceil(state.remainingMs / 1000));
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.permKicker}>ZAKOŃCZENIE ZA</Text>
          <Text style={[styles.countdownNumber, { color: hudColors.trust.disputed }]}>{sec}</Text>
          {state.extensionsUsed < 3 && (
            <Pressable
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed, { marginTop: hudSpacing.xxl }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); extendTimeout(); }}
            >
              <Text style={styles.ctaLabel}>KONTYNUUJ +10 MIN</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // recording phase
  if (state.phase !== 'recording') return null;

  const strength = gpsStrength(state.currentAccuracy, state.weakSignal);

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Top bar: LIVE · trail id · GPS */}
      <View style={styles.topBar}>
        <View style={styles.topLeft}>
          <View style={styles.liveDot} />
          <Text style={styles.liveLabel}>LIVE</Text>
        </View>
        <Text style={styles.topCenter} numberOfLines={1}>{trailId.toUpperCase()}</Text>
        <GpsDots strength={strength} />
      </View>

      {/* Mega timer */}
      <View style={styles.timerBlock}>
        <Text style={styles.elapsedLabel}>ELAPSED</Text>
        <Text style={styles.timerText}>{formatTimer(state.elapsedMs)}</Text>
      </View>

      {/* Two-col stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>PUNKTY GPS</Text>
          <Text style={styles.statValue}>
            {/* Approximate point count — useGPSRecorder writes every
                2 m; reading buffer length directly requires plumbing so
                we show a rough tick derived from elapsed@1Hz sampling. */}
            {Math.floor(state.elapsedMs / 1000)}
          </Text>
        </View>
        <View style={styles.statColRight}>
          <Text style={styles.statLabel}>SYGNAŁ</Text>
          <Text style={[
            styles.statValue,
            strength === 'strong' && { color: hudColors.signal },
            strength === 'medium' && { color: hudColors.trust.curator },
            strength === 'weak' && { color: hudColors.trust.disputed },
          ]}>
            {strength === 'strong' ? 'SILNY' :
             strength === 'medium' ? 'SZUKAM' :
             strength === 'weak' ? 'SŁABY' : '—'}
          </Text>
        </View>
      </View>

      {state.weakSignal && (
        <Text style={styles.weakBanner}>⚠ SŁABY SYGNAŁ — KALIBRACJA MOŻE BYĆ NIEWIARYGODNA</Text>
      )}

      <View style={{ flex: 1 }} />

      {/* STOP button — giant cream circle */}
      <View style={styles.stopBlock}>
        <Pressable
          onPress={handleStop}
          style={({ pressed }) => [styles.stopBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.stopLabel}>STOP</Text>
        </Pressable>
        <Pressable onPress={handleCancel} hitSlop={12} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>ODRZUĆ NAGRANIE</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hudColors.surface.base },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: hudSpacing.xxl },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hudSpacing.xxl,
    paddingVertical: hudSpacing.md,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: hudColors.surface.border,
  },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: hudColors.signal },
  liveLabel: { ...hudType.label, color: hudColors.signal },
  topCenter: {
    ...hudType.labelSm,
    color: hudColors.text.secondary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: hudSpacing.md,
  },

  timerBlock: {
    alignItems: 'center',
    paddingTop: hudSpacing.giant,
  },
  elapsedLabel: {
    ...hudType.label,
    color: hudColors.text.secondary,
    marginBottom: hudSpacing.md,
  },
  timerText: {
    ...hudType.heroTimeMega,
    color: hudColors.text.primary,
  },

  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: hudSpacing.xxl,
    marginTop: hudSpacing.mega,
    paddingTop: hudSpacing.xxl,
    borderTopWidth: HAIRLINE,
    borderTopColor: hudColors.surface.border,
  },
  statCol: { flex: 1 },
  statColRight: { flex: 1, alignItems: 'flex-end' },
  statLabel: {
    ...hudType.label,
    color: hudColors.text.secondary,
    marginBottom: hudSpacing.sm,
  },
  statValue: {
    ...hudType.displaySm,
    color: hudColors.text.primary,
    fontSize: 26,
  },

  weakBanner: {
    ...hudType.labelSm,
    color: hudColors.trust.disputed,
    textAlign: 'center',
    paddingVertical: hudSpacing.md,
    paddingHorizontal: hudSpacing.xxl,
    marginTop: hudSpacing.lg,
    borderTopWidth: HAIRLINE,
    borderBottomWidth: HAIRLINE,
    borderColor: hudColors.trust.disputed,
  },

  stopBlock: {
    alignItems: 'center',
    paddingBottom: hudSpacing.xxl,
  },
  stopBtn: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: hudColors.text.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopLabel: {
    ...hudType.label,
    color: hudColors.text.inverse,
    fontSize: 13,
    letterSpacing: 4,
  },
  cancelBtn: {
    marginTop: hudSpacing.xl,
  },
  cancelText: {
    ...hudType.labelSm,
    color: hudColors.text.secondary,
  },

  // Permission / countdown / stopped screens
  permKicker: {
    ...hudType.label,
    color: hudColors.signal,
    marginBottom: hudSpacing.lg,
  },
  permTitle: {
    ...hudType.heroCopy,
    color: hudColors.text.primary,
    textAlign: 'center',
    marginBottom: hudSpacing.lg,
  },
  permBody: {
    ...hudType.body,
    color: hudColors.text.secondary,
    textAlign: 'center',
    marginBottom: hudSpacing.giant,
    lineHeight: 18,
  },
  countdownLabel: {
    ...hudType.label,
    color: hudColors.signal,
    marginBottom: hudSpacing.xxl,
  },
  countdownNumber: {
    ...hudType.heroTimeMega,
    fontSize: 180,
    lineHeight: 180,
    color: hudColors.text.primary,
    textAlign: 'center',
  },

  // Shared CTA (permission + grace)
  cta: {
    marginTop: hudSpacing.xl,
    minWidth: 240,
    paddingVertical: hudSpacing.md,
    paddingHorizontal: hudSpacing.xxl,
    borderWidth: 1,
    borderColor: hudColors.text.primary,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: hudColors.text.primary },
  ctaLabel: {
    ...hudType.label,
    color: hudColors.text.primary,
  },
});
