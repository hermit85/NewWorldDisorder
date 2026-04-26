// ═══════════════════════════════════════════════════════════
// /run/recording — active Pioneer recording screen.
// Game-HUD polish pass: dark terrain gradient, neon timer glow,
// finish-line stripes on the STOP CTA, 3-dot GPS strength indicator.
// Chunk 5: non-cancel stop routes to /run/review for finalize;
// useKeepAwake during active phases so the screen never sleeps mid-ride.
// ═══════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Alert, Linking, Animated, Easing, AppState, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { spacing, radii } from '@/theme/spacing';
import { hudTypography, hudShadows } from '@/theme/gameHud';
import { colors } from '@/theme/colors';
import { useGPSRecorder } from '@/features/recording/useGPSRecorder';
import { useGpsWarmup } from '@/features/recording/useGpsWarmup';
import { READINESS_GATE } from '@/features/recording/validators';
import { useLocationPermission } from '@/features/permissions/useLocationPermission';
import * as recordingStore from '@/features/recording/recordingStore';
import { MotivationStack } from '@/components/run/MotivationStack';

const TERRAIN_GRADIENT: readonly [string, string, string] = [
  colors.panel,
  colors.chrome,
  colors.bg,
];

const DANGER_GRADIENT: readonly [string, string] = [
  colors.bg,
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

/** Polish relative age — "mniej niż minutę temu" / "12 min temu".
 *  Minute-granularity is enough for the resume prompt; no need to
 *  say "sprzed 7 sekund" which would invite the rider to just
 *  restart. */
function formatAgo(ageMs: number): string {
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 1) return 'mniej niż minutę temu';
  return `${minutes} min temu`;
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
    strength === 'strong' ? colors.accent :
    strength === 'medium' ? colors.warn :
    strength === 'weak'   ? colors.danger   :
    'rgba(255, 255, 255, 0.18)';
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
            { backgroundColor: i < activeCount ? color : 'rgba(255, 255, 255, 0.18)' },
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

  // Keep the screen on for the lifetime of this mount. Native-only —
  // the web Wake Lock API needs a user gesture and rejects on first
  // mount, which surfaces as an unhandled pageerror in the dev
  // preview (and Sentry replays). Native iOS / Android use a separate
  // code path that doesn't have that constraint, so we call the
  // imperative activate/deactivate gated on Platform.OS instead of
  // relying on the hook (which has no built-in web bypass). All
  // non-cancel exits unmount this screen (review / back to trail),
  // so the cleanup runs naturally.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    void activateKeepAwakeAsync('nwd-recording');
    return () => { void deactivateKeepAwake('nwd-recording'); };
  }, []);

  const {
    state,
    startCountdown,
    stopRecording,
    cancelRecording,
    extendTimeout,
    resumeSession,
    discardResumable,
  } = useGPSRecorder({ trailId, spotId });

  // Chunk 7: single source of truth for iOS location permissions.
  // Stage 1 (When-In-Use) auto-requests on mount; stage 2 (Always) is
  // a contextual ask fired the first time the user taps START so the
  // request has clear motivation attached.
  const permission = useLocationPermission();

  // Pre-flight GPS warm-up. Enabled while we're in 'idle' (before the
  // user taps START) and disabled the instant we hand off to the
  // recorder. expo-location allows parallel subscriptions so the brief
  // overlap at handoff is harmless.
  const [hasStarted, setHasStarted] = useState(false);
  const warmup = useGpsWarmup({
    enabled: state.phase === 'idle' && !hasStarted,
    maxAccuracyM: READINESS_GATE.PIONEER_MAX_ACCURACY_M,
    foregroundStatus: permission.foregroundStatus,
  });

  // Always-permission explainer modal: surfaced between the user's
  // intent to START and the actual iOS permission prompt, so the ask
  // has context ("why we need Always"). One-shot per screen mount —
  // if the user dismisses and taps START again we re-show it only if
  // permission is still not granted.
  const [showAlwaysExplainer, setShowAlwaysExplainer] = useState(false);

  // Chunk 7 Phase 6: re-read permission statuses on every foreground
  // return. Without this, a rider who tapped USTAWIENIA in the banner
  // and flipped Always from denied → granted in iOS Settings would
  // still see the banner (and the hook would still report denied)
  // until the screen remounted. permission.refresh reads both
  // foreground + background statuses via getForegroundPermissionsAsync
  // / getBackgroundPermissionsAsync — no user prompts, just state sync.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void permission.refresh();
      }
    });
    return () => sub.remove();
  }, [permission]);

  const lastCountdownSecondRef = useRef<number | null>(null);
  const lastWeakSignalRef = useRef<boolean>(false);
  const enteredGraceRef = useRef<boolean>(false);
  const stoppedHandledRef = useRef<boolean>(false);
  const prevPhaseRef = useRef<string>('idle');

  const recordingPulse = usePulseAnim(0.4, 0.8, 800);

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

  // Chunk 6 v3: Recording no longer auto-starts. The user taps
  // `handleStart` once the warm-up hook reports `readinessPhase ===
  // 'armed'`, giving an explicit moment to commit and preventing
  // bad runs from stale fixes.

  // ── Countdown haptic + scale pop ────────────────────────

  useEffect(() => {
    if (state.phase !== 'countdown') {
      lastCountdownSecondRef.current = null;
      return;
    }
    const second = Math.ceil(state.remainingMs / 1000);
    if (lastCountdownSecondRef.current !== second) {
      lastCountdownSecondRef.current = second;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase]);

  // ── Weak signal edge haptic ─────────────────────────────

  useEffect(() => {
    if (state.phase !== 'recording') return;
    if (state.weakSignal && !lastWeakSignalRef.current) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    }
    lastWeakSignalRef.current = state.weakSignal;
  }, [state]);

  // ── Grace entry haptic ──────────────────────────────────

  useEffect(() => {
    if (state.phase === 'timeout_grace' && !enteredGraceRef.current) {
      enteredGraceRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
    } else if (state.phase !== 'timeout_grace') {
      enteredGraceRef.current = false;
    }
  }, [state.phase]);

  // ── Stopped → route ─────────────────────────────────────
  //
  // Non-cancel stops hand the buffer off to /run/review. We flush the
  // buffer explicitly here because useGPSRecorder only persists on its
  // 10 s save interval — a quick STOP (< 10 s) would otherwise leave
  // review with nothing to restore.

  useEffect(() => {
    if (state.phase !== 'stopped' || stoppedHandledRef.current) return;
    stoppedHandledRef.current = true;

    if (state.reason === 'cancel') {
      void recordingStore.clearBuffer();
      router.back();
      return;
    }

    const proceedToReview = async () => {
      // Codex S4: preserve the ORIGINAL startedAt from the persisted
      // buffer rather than deriving one from Date.now() - lastPoint.t.
      // The derived form drifts by however long the finalize flow
      // takes (stop → task teardown → drain → this effect), which on
      // a slow device can be hundreds of ms. The review screen relies
      // on startedAt for the race-time anchor — drift there rolls
      // into the duration shown to the rider.
      //
      // drainAndSettle ensured every task append completed before the
      // 'stopped' state fired, so this read is the authoritative
      // snapshot. Fall back to Date.now() only when the buffer is
      // missing entirely (shouldn't happen post-drain, defensive).
      const persisted = await recordingStore.drainAndSettle();
      const startedAt = persisted?.startedAt ?? Date.now();

      await recordingStore.saveBuffer({
        trailId,
        spotId,
        startedAt,
        sessionId: persisted?.sessionId,
        points: state.points,
      });
      router.replace(`/run/review?trailId=${trailId}&spotId=${spotId}`);
    };

    // Sanity guard: a STOP that captured almost no points usually means
    // permissions failed, the rider tapped too fast, or GPS never locked.
    // Surface it before /run/review so the user isn't confused by
    // negative timers / empty polylines downstream.
    if (state.points.length < 5) {
      Alert.alert(
        'Nagranie nieważne',
        `Zebrano ${state.points.length} ${state.points.length === 1 ? 'punkt' : 'punkty'} GPS. ` +
        'Zjedź dłużej albo sprawdź pozwolenia GPS.',
        [
          {
            text: 'Wróć do trasy',
            style: 'cancel',
            onPress: () => {
              void recordingStore.clearBuffer();
              router.back();
            },
          },
          {
            text: 'Kontynuuj mimo to',
            onPress: () => { void proceedToReview(); },
          },
        ],
      );
      return;
    }

    void proceedToReview();
  }, [state, router, trailId, spotId]);

  // ── Handlers ─────────────────────────────────────────────

  const handleCancelPress = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    Alert.alert(
      'Odrzucić nagranie?',
      'Trasa zostanie, ale ten zjazd nie zostanie zapisany.',
      [
        { text: 'Kontynuuj nagrywanie', style: 'cancel' },
        {
          text: 'Odrzuć',
          style: 'destructive',
          onPress: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
            cancelRecording();
          },
        },
      ],
    );
  }, [cancelRecording]);

  const handleStopPress = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    stopRecording();
  }, [stopRecording]);

  const handleExtend = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    extendTimeout();
  }, [extendTimeout]);

  // Actual start — runs after the Always-permission gate resolves
  // (either granted, denied, or explicitly skipped). Setting
  // hasStarted true first disables the warm-up hook, which tears
  // down its subscription on the next render. startCountdown opens
  // its own subscription after the 3s pre-roll; brief overlap is
  // intentional and accepted.
  const beginRecording = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    setHasStarted(true);
    void startCountdown();
  }, [startCountdown]);

  // Explicit start — fires from the armed-state START CTA. If the
  // Always permission hasn't been asked yet (or was denied without
  // an explainer), surface the explainer modal first so the iOS
  // prompt arrives with context. Otherwise begin immediately.
  const handleStart = useCallback(() => {
    Haptics.selectionAsync().catch(() => undefined);
    if (permission.backgroundStatus === 'granted') {
      beginRecording();
      return;
    }
    // Not yet granted — show the explainer. The modal's CTA triggers
    // `requestBackground` → `beginRecording` regardless of outcome,
    // so the rider is never stuck behind a denied Always gate (Phase 5
    // handles the degraded foreground-only UX).
    setShowAlwaysExplainer(true);
  }, [permission.backgroundStatus, beginRecording]);

  // Explainer → iOS prompt → begin. Runs whether Always ends up
  // granted or denied — denial is a graceful-degradation path, not
  // a blocker (Phase 5 adds the foreground-only banner).
  const handleExplainerContinue = useCallback(async () => {
    setShowAlwaysExplainer(false);
    await permission.requestBackground();
    beginRecording();
  }, [permission, beginRecording]);

  const handleExplainerCancel = useCallback(() => {
    setShowAlwaysExplainer(false);
  }, []);

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
        {/* Phase 5 — Always-denied banner. Recording still works
            (foreground only) but the rider needs to know the tradeoff
            before they put the phone in their pocket. Visible only
            during active-recording phases so idle / resumable / stopped
            screens stay clean. Tap → iOS Settings deep link. */}
        {permission.backgroundStatus !== 'granted'
          && (state.phase === 'countdown'
            || state.phase === 'recording'
            || state.phase === 'timeout_grace') && (
          <View style={styles.alwaysDeniedBanner}>
            <View style={styles.alwaysDeniedText}>
              <Text style={styles.alwaysDeniedTitle}>
                ⚠ NAGRYWANIE TYLKO GDY APKA OTWARTA
              </Text>
              <Text style={styles.alwaysDeniedSub}>
                Telefon w kieszeni = utrata czasu. Włącz „Zawsze" w ustawieniach.
              </Text>
            </View>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => undefined);
                void Linking.openSettings();
              }}
              style={({ pressed }) => [
                styles.alwaysDeniedBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.alwaysDeniedBtnLabel}>USTAWIENIA</Text>
            </Pressable>
          </View>
        )}

        {/* RESUMABLE — Phase 4: buffer detected for this trail with
            valid sessionId + >10 samples + <1h age. Rider can
            continue or discard; we render this BEFORE permission /
            idle so a valid resumable session isn't clobbered by the
            warm-up flow on every remount. */}
        {state.phase === 'resumable' && (
          <View style={styles.centered}>
            <View style={styles.resumableCard}>
              <Text style={styles.resumableKicker}>● ZAPISANY ZJAZD</Text>
              <Text style={styles.resumableTitle}>NIEDOKOŃCZONY ZJAZD</Text>
              <Text style={styles.resumableBody}>
                Wykryto {state.pointCount} punktów GPS, {formatAgo(state.ageMs)}.
                Kontynuować?
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
                  void resumeSession();
                }}
                style={({ pressed }) => [
                  styles.resumableCta,
                  hudShadows.glowGreen,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.resumableCtaLabel}>KONTYNUUJ</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  void discardResumable();
                }}
                style={styles.resumableCancel}
              >
                <Text style={styles.resumableCancelLabel}>ODRZUĆ</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* RESUMABLE BROKEN — edge case: buffer exists for this trail
            and is recent, but malformed (no sessionId or <10 points).
            Cannot resume; only clear. */}
        {state.phase === 'resumable_broken' && (
          <View style={styles.centered}>
            <View style={styles.resumableBrokenCard}>
              <Text style={styles.resumableBrokenKicker}>● USZKODZONE</Text>
              <Text style={styles.resumableTitle}>STARE DANE</Text>
              <Text style={styles.resumableBody}>
                Niedokończony zjazd jest uszkodzony i nie może być kontynuowany.
              </Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  void discardResumable();
                }}
                style={({ pressed }) => [
                  styles.resumableCta,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.resumableCtaLabel}>WYCZYŚĆ</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* PERMISSION PHASES — fired by either the warm-up hook
            (pre-start) or useGPSRecorder.startCountdown (post-tap).
            Both paths surface an identical UI so users always see
            the same "open settings" escape hatch. */}
        {(state.phase === 'permission_requesting'
          || state.phase === 'permission_denied'
          || (state.phase === 'idle' && warmup.permissionDenied)) && (
          <View style={styles.centered}>
            <View style={styles.lockBox}>
              <Text style={styles.lockGlyph}>⌖</Text>
            </View>
            <Text style={styles.permTitle}>GPS WYŁĄCZONY</Text>
            <Text style={styles.permBody}>
              NWD potrzebuje dostępu do lokalizacji.{'\n'}Włącz w ustawieniach.
            </Text>
            {(state.phase === 'permission_denied' || warmup.permissionDenied) && (
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

        {/* IDLE — readiness UI + gated START CTA. Only rendered when
            permission is granted (or still pending); the block above
            handles the denied path. */}
        {state.phase === 'idle' && !warmup.permissionDenied && (
          <View style={styles.idleRoot}>
            <View style={styles.idleBody}>
              <Text style={styles.idleTitle}>PRZYGOTUJ GPS</Text>
              <Text style={styles.idleBodyText}>
                Sygnał musi być stabilny zanim zaczniemy nagrywać. Na otwartej
                przestrzeni zajmuje to 5–15 sekund.
              </Text>

              <View
                style={[
                  styles.readinessCard,
                  warmup.readinessPhase === 'warm'  && styles.readinessCardWarm,
                  warmup.readinessPhase === 'armed' && styles.readinessCardReady,
                ]}
              >
                <View style={styles.readinessKickerRow}>
                  {warmup.readinessPhase === 'armed' ? (
                    <Text style={[styles.readinessKickerSymbol, { color: colors.accent }]}>
                      ✦
                    </Text>
                  ) : (
                    <Animated.Text
                      style={[
                        styles.readinessKickerSymbol,
                        { opacity: recordingPulse },
                        warmup.readinessPhase === 'warm' && { color: colors.warn },
                      ]}
                    >
                      ●
                    </Animated.Text>
                  )}
                  <Text
                    style={[
                      styles.readinessKicker,
                      warmup.readinessPhase === 'warm'  && { color: colors.warn },
                      warmup.readinessPhase === 'armed' && { color: colors.accent },
                    ]}
                  >
                    {warmup.readinessPhase === 'searching' && 'CZEKAM NA GPS'}
                    {warmup.readinessPhase === 'warm'     && 'ROZGRZEWAM GPS'}
                    {warmup.readinessPhase === 'armed'    && 'GPS GOTOWY'}
                  </Text>
                </View>
                <Text style={styles.readinessSub}>
                  {warmup.readinessPhase === 'searching' && 'Stań na otwartej przestrzeni'}
                  {warmup.readinessPhase === 'warm' &&
                    `Sygnał ${warmup.consecutiveFreshCount}/${READINESS_GATE.MIN_CONSECUTIVE_FRESH_FIXES}`
                    + (warmup.latestAccuracy !== null
                      ? ` · ±${Math.round(warmup.latestAccuracy)}m`
                      : '')}
                  {warmup.readinessPhase === 'armed' &&
                    `${READINESS_GATE.MIN_CONSECUTIVE_FRESH_FIXES}/${READINESS_GATE.MIN_CONSECUTIVE_FRESH_FIXES} sygnał`
                    + (warmup.latestAccuracy !== null
                      ? ` · ±${Math.round(warmup.latestAccuracy)}m`
                      : '')}
                </Text>
              </View>
            </View>

            <View style={styles.idleFooter}>
              <Pressable
                onPress={handleStart}
                disabled={warmup.readinessPhase !== 'armed'}
                style={({ pressed }) => [
                  styles.startCta,
                  warmup.readinessPhase === 'armed' && hudShadows.glowGreen,
                  warmup.readinessPhase !== 'armed' && styles.startCtaDisabled,
                  pressed && warmup.readinessPhase === 'armed' && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text
                  style={[
                    styles.startCtaLabel,
                    warmup.readinessPhase !== 'armed' && styles.startCtaLabelDisabled,
                  ]}
                >
                  {warmup.readinessPhase === 'armed'
                    ? '✦ ROZPOCZNIJ NAGRYWANIE'
                    : 'CZEKAM NA GPS…'}
                </Text>
              </Pressable>
              <Pressable style={styles.idleCancel} onPress={() => router.back()}>
                <Text style={styles.idleCancelLabel}>ANULUJ</Text>
              </Pressable>
            </View>

            {/* Always-permission explainer — overlays the idle screen
                when the rider first taps START without Always granted.
                Contextual ask: user sees WHY before iOS shows its
                generic dialog. Closing the modal without "Kontynuuj"
                keeps the rider on idle so they can rethink. */}
            {showAlwaysExplainer && (
              <View style={styles.explainerOverlay}>
                <View style={styles.explainerCard}>
                  <Text style={styles.explainerKicker}>● POZWOLENIE GPS</Text>
                  <Text style={styles.explainerTitle}>TIMER MUSI DZIAŁAĆ W KIESZENI</Text>
                  <Text style={styles.explainerBody}>
                    NWD nagrywa czas nawet gdy telefon jest w kieszeni lub na
                    kierownicy z wyłączonym ekranem. iOS poprosi za chwilę o
                    zgodę „Zawsze” — to niezbędne dla timera zjazdu.
                  </Text>
                  <Text style={styles.explainerBody}>
                    Niebieski pasek na górze ekranu potwierdzi, że nagrywanie
                    działa.
                  </Text>
                  <Pressable
                    onPress={handleExplainerContinue}
                    style={({ pressed }) => [
                      styles.explainerCta,
                      hudShadows.glowGreen,
                      pressed && { transform: [{ scale: 0.98 }] },
                    ]}
                  >
                    <Text style={styles.explainerCtaLabel}>KONTYNUUJ</Text>
                  </Pressable>
                  <Pressable onPress={handleExplainerCancel} style={styles.explainerCancel}>
                    <Text style={styles.explainerCancelLabel}>WRÓĆ</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}

        {/* STORAGE ERROR — initial saveBuffer failed. Retry via
            the same startCountdown entry point used by the explainer
            modal's continue path. No permission dance needed; the
            user has already granted everything by this point. */}
        {state.phase === 'storage_error' && (
          <View style={styles.centered}>
            <View style={styles.storageErrorCard}>
              <Text style={styles.storageErrorKicker}>● BŁĄD PAMIĘCI</Text>
              <Text style={styles.storageErrorTitle}>NIE MOŻNA ROZPOCZĄĆ</Text>
              <Text style={styles.storageErrorBody}>{state.message}</Text>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync().catch(() => undefined);
                  void startCountdown();
                }}
                style={({ pressed }) => [
                  styles.storageErrorCta,
                  pressed && { transform: [{ scale: 0.98 }] },
                ]}
              >
                <Text style={styles.storageErrorCtaLabel}>SPRÓBUJ PONOWNIE</Text>
              </Pressable>
              <Pressable style={styles.permCancel} onPress={() => router.back()}>
                <Text style={styles.permCancelLabel}>ANULUJ</Text>
              </Pressable>
            </View>
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

            {/* weakBanner removed in Chunk 6 v3 polish — the liveStatusBar
                below the timer already surfaces "⚠ słaby sygnał" inline
                when state.weakSignal trips. Keeping both was redundant. */}

            <View style={styles.timerWrap}>
              <View style={[styles.timerBox, hudShadows.glowTimer]}>
                <Text
                  style={styles.timerText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {formatTimer(state.elapsedMs)}
                </Text>
                <Animated.Text style={[styles.timerSubLabel, { opacity: recordingPulse }]}>
                  ● REKORDUJE
                </Animated.Text>
              </View>
            </View>

            {/* Live status bar — condensed always-visible confirmation
                that GPS + buffering are active. Pulsing dot uses the
                same recordingPulse animation as the timer sublabel for
                rhythm continuity. */}
            <View style={styles.liveStatusBar}>
              <Animated.Text style={[styles.liveStatusDot, { opacity: recordingPulse }]}>
                ●
              </Animated.Text>
              <Text style={styles.liveStatusText}>
                {state.currentAccuracy !== null
                  ? `GPS ±${Math.round(state.currentAccuracy)}m`
                  : 'GPS — czekam na fix'}
                {state.weakSignal && (
                  <Text style={styles.liveStatusWarn}>  ·  ⚠ słaby sygnał</Text>
                )}
              </Text>
            </View>

            {/* Gaming-context cards — Pioneer variant renders only the
                neutral first-descent card. Draft trails have no PB and
                an empty leaderboard so delta / rival / king states are
                unreachable here by construction (see app/run/active.tsx
                for the Rider variant with the full state machine). */}
            <MotivationStack
              elapsedMs={state.elapsedMs}
              userPbMs={null}
              rivalAbove={null}
              userRank={null}
              variant="pioneer"
            />

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
                      { backgroundColor: i % 2 === 0 ? colors.bg : colors.textPrimary },
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
                      { backgroundColor: i % 2 === 0 ? colors.textPrimary : colors.bg },
                    ]}
                  />
                ))}
              </View>
            </Pressable>

            {/* Chunk 6 v3's foregroundWarning footer ("Trzymaj apkę
                otwartą · ekran włączony") was removed in Chunk 7
                Phase 5. With Always permission granted (default happy
                path post-Chunk-7) the task keeps recording when the
                screen is off — the footer would have been misleading.
                The new top banner renders only when Always is denied
                and communicates the constraint more clearly. */}
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

        {/* STOPPED — brief flash before router.replace to /run/review */}
        {state.phase === 'stopped' && state.reason !== 'cancel' && (
          <View style={styles.centered}>
            <Text style={styles.processingLabel}>PRZETWARZANIE…</Text>
            <Text style={styles.processingHint}>
              {state.points.length} punktów
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },

  // ── Idle / warm-up ──
  idleRoot: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  idleBody: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  idleTitle: {
    ...hudTypography.displayLarge,
    fontSize: 28,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 4,
  },
  idleBodyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  readinessCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(232, 255, 240, 0.12)',
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.sm,
  },
  readinessKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readinessKickerSymbol: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 14,
    color: colors.textSecondary,
  },
  readinessCardWarm: {
    borderColor: colors.warn,
    backgroundColor: 'rgba(255, 217, 61, 0.06)',
  },
  readinessCardReady: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(0, 255, 140, 0.08)',
  },
  readinessKicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 14,
    letterSpacing: 3,
    color: colors.textSecondary,
  },
  readinessSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  idleFooter: {
    gap: spacing.sm,
  },
  startCta: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 64,
  },
  startCtaDisabled: {
    backgroundColor: 'rgba(232, 255, 240, 0.08)',
  },
  startCtaLabel: {
    ...hudTypography.action,
    fontSize: 16,
    color: colors.bg,
    letterSpacing: 3,
  },
  startCtaLabelDisabled: {
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  idleCancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  idleCancelLabel: {
    ...hudTypography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 2,
  },

  // Always-permission explainer modal
  explainerOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10, 15, 10, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    zIndex: 20,
  },
  explainerCard: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.md,
    padding: spacing.xl,
    gap: spacing.md,
    alignSelf: 'stretch',
  },
  explainerKicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: colors.accent,
  },
  explainerTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 20,
    letterSpacing: 2,
    color: colors.textPrimary,
  },
  explainerBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
  explainerCta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  explainerCtaLabel: {
    ...hudTypography.action,
    fontSize: 14,
    color: colors.bg,
    letterSpacing: 3,
  },
  explainerCancel: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  explainerCancelLabel: {
    ...hudTypography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 2,
  },

  // Storage error (initial saveBuffer failed — Codex S3 surface)
  storageErrorCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 67, 101, 0.08)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  storageErrorKicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: colors.danger,
  },
  storageErrorTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 20,
    letterSpacing: 2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  storageErrorBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  storageErrorCta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  storageErrorCtaLabel: {
    ...hudTypography.action,
    fontSize: 14,
    color: colors.bg,
    letterSpacing: 3,
  },

  // Resumable prompt (normal path — buffer valid + resumable)
  resumableCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(0, 255, 140, 0.06)',
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radii.md,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  resumableKicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: colors.accent,
  },
  resumableTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 22,
    letterSpacing: 2,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  resumableBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  resumableCta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.sm,
    alignSelf: 'stretch',
  },
  resumableCtaLabel: {
    ...hudTypography.action,
    fontSize: 14,
    color: colors.bg,
    letterSpacing: 3,
  },
  resumableCancel: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  resumableCancelLabel: {
    ...hudTypography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 2,
  },

  // Resumable-broken variant — amber kicker signals "data exists
  // but not useful", differentiating from the emerald "you have a
  // good session to resume" card.
  resumableBrokenCard: {
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255, 217, 61, 0.06)',
    borderWidth: 1,
    borderColor: colors.warn,
    borderRadius: radii.md,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'center',
  },
  resumableBrokenKicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: colors.warn,
  },

  // Permission
  lockBox: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...hudShadows.glowGreen,
  },
  lockGlyph: { fontSize: 42, color: colors.accent, fontFamily: 'Rajdhani_700Bold' },
  permTitle: {
    ...hudTypography.displayLarge,
    fontSize: 36,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  permBody: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    fontSize: 15,
    lineHeight: 22,
  },
  permCta: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
  },
  permCtaLabel: {
    ...hudTypography.label,
    fontSize: 13,
    color: colors.bg,
    letterSpacing: 3,
  },
  permCancel: { paddingVertical: spacing.md },
  permCancelLabel: { ...hudTypography.labelSmall, color: colors.textSecondary },

  // Countdown
  countdownNumber: {
    ...hudTypography.displayCountdown,
    color: colors.textPrimary,
  },
  countdownLabel: {
    ...hudTypography.label,
    fontSize: 13,
    color: colors.accent,
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
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  cancelBtn: { alignItems: 'flex-end' },
  cancelLabel: {
    ...hudTypography.label,
    color: colors.danger,
    fontSize: 12,
  },
  cancelSubtitle: {
    ...hudTypography.labelSmall,
    color: colors.textSecondary,
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
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 64,
    letterSpacing: 2,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'] as any,
    textShadowColor: colors.accent,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  timerSubLabel: {
    fontFamily: 'Rajdhani_700Bold',
    color: colors.accent,
    marginTop: spacing.sm,
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },

  // Live status bar (between timer and MotivationStack during recording)
  liveStatusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginHorizontal: spacing.lg,
  },
  liveStatusDot: {
    color: colors.accent,
    fontSize: 12,
  },
  liveStatusText: {
    fontFamily: 'Rajdhani_500Medium',
    fontSize: 12,
    color: colors.textSecondary,
    letterSpacing: 1,
  },
  liveStatusWarn: {
    color: colors.warn,
    fontSize: 12,
  },

  // Phase 5 — Always-denied banner. Amber tint signals "attention
  // needed, not broken"; red would be wrong since recording still
  // works, just foreground-only. Renders in-flow at top of
  // SafeAreaView so the centered countdown / recording layout below
  // naturally shifts down without absolute-positioning math.
  alwaysDeniedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255, 217, 61, 0.10)',
    borderBottomWidth: 1,
    borderBottomColor: colors.warn,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  alwaysDeniedText: {
    flex: 1,
  },
  alwaysDeniedTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    letterSpacing: 2,
    color: colors.warn,
  },
  alwaysDeniedSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  alwaysDeniedBtn: {
    borderWidth: 1,
    borderColor: colors.warn,
    borderRadius: radii.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  alwaysDeniedBtnLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: colors.warn,
  },

  stopCta: {
    marginHorizontal: spacing.lg,
    height: '40%',
    borderRadius: 24,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.accent,
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
    color: colors.bg,
    letterSpacing: 4,
  },

  // Grace
  graceEyebrow: {
    ...hudTypography.label,
    color: colors.danger,
    letterSpacing: 6,
    marginBottom: spacing.lg,
  },
  graceCountdown: {
    ...hudTypography.displayCountdown,
    fontSize: 140,
    lineHeight: 140,
    color: colors.danger,
    marginBottom: spacing.lg,
  },
  graceBody: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    fontSize: 14,
  },
  extendCta: {
    backgroundColor: colors.warn,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  extendLabel: {
    ...hudTypography.action,
    fontSize: 18,
    color: colors.bg,
    letterSpacing: 3,
  },

  // Stopped placeholder
  processingLabel: {
    ...hudTypography.displayLarge,
    fontSize: 32,
    color: colors.textPrimary,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  processingHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
