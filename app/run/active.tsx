import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Linking, AppState } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { formatTime } from '@/content/copy';
import { Btn, IconGlyph, Pill, RaceTime } from '@/components/nwd';
import { useRealRun } from '@/systems/useRealRun';
import { ReadinessPanel } from '@/components/run/ReadinessPanel';
import { ApproachView } from '@/components/run/ApproachView';
import { DebugOverlay } from '@/components/run/DebugOverlay';
import { computeApproachState } from '@/features/run/approachNavigator';
import { tapLight, tapMedium, tapHeavy, notifySuccess, notifyWarning, notifyError } from '@/systems/haptics';
import { useAuthContext } from '@/hooks/AuthContext';
import { useTrail, useTrailGeometry, useUserTrailStats, useLeaderboard } from '@/hooks/useBackend';
import { resolveVenue } from '@/features/run/resolveVenue';
import { MotivationStack, type RivalAbove } from '@/components/run/MotivationStack';
import { useLocationPermission } from '@/features/permissions/useLocationPermission';
import {
  parseRunIntent,
  decideIntentGuard,
  getIntentGuardMessage,
  resolveHookIntent,
} from '@/features/run/runIntent';

export default function ActiveRunScreen() {
  const params = useLocalSearchParams<{
    trailId: string;
    trailName: string;
    intent: string;
  }>();
  const trailId = params.trailId ?? '';
  const trailName = params.trailName ?? 'Unknown Trail';
  const router = useRouter();
  const navigation = useNavigation();
  const [showDebug, setShowDebug] = useState(false);
  const [debugTaps, setDebugTaps] = useState(0);
  const debugTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { profile } = useAuthContext();

  // Trail context fetch. Geometry is only fetched for DB-sourced
  // trails; the static registry carries its own geo inline so we skip
  // the network trip when resolveVenue will pick the static branch.
  const { trail: dbTrail, status: trailStatus } = useTrail(trailId || null);
  const { geometry: pioneerGeometryRaw } = useTrailGeometry(trailId || null);
  const venue = resolveVenue({
    trailId: trailId || null,
    trailName,
    dbTrail: dbTrail ? { spotId: dbTrail.spotId } : null,
    pioneerGeometryRaw,
  });
  const spotId = venue.spotId;
  const isTrainingOnly = venue.source === 'static' && !venue.rankingEnabled;
  const geo = venue.trailGeo;
  const gateConfig = venue.gateConfig;

  // B29: intent is the rider's pre-declared choice (Ranking vs Trening),
  // validated from route params. Missing/invalid intent → redirect to
  // trail detail so rider picks deliberately. On training-only trails,
  // `intent=ranked` is also rejected (they should land on Trening).
  // This removes the entire silent-downgrade class of bugs — there's no
  // code path left that can turn a ranked intent into a practice run
  // without rider consent. Parsing + guard decision live in
  // src/features/run/runIntent.ts so the rules are unit-testable.
  const intent = parseRunIntent(params.intent);
  const intentInvalidRef = useRef(false);
  useEffect(() => {
    if (intentInvalidRef.current) return;
    if (!trailId) return; // handled by the deep-link guard below
    const decision = decideIntentGuard({ intent, isTrainingOnly });
    if (decision.action === 'redirect') {
      intentInvalidRef.current = true;
      const { title, body } = getIntentGuardMessage(decision.reason);
      Alert.alert(title, body, [
        {
          text: 'OK',
          onPress: () => {
            router.replace({ pathname: '/trail/[id]', params: { id: trailId } });
          },
        },
      ]);
    }
  }, [intent, trailId, isTrainingOnly, router]);

  // Guard: deep-linked trailId points at a trail that doesn't exist in
  // DB (deleted, bad link, legacy id). Without this, the screen happily
  // mounts as "UNKNOWN TRAIL" with a live 00.00 timer and no way to tell
  // the rider why the race isn't starting.
  const guardedRef = useRef(false);
  useEffect(() => {
    if (guardedRef.current) return;
    if (!trailId) {
      guardedRef.current = true;
      router.replace('/');
      return;
    }
    if (venue.source !== 'static' && trailStatus === 'empty') {
      guardedRef.current = true;
      Alert.alert(
        'Trasa nie istnieje',
        'Ta trasa została usunięta lub nie masz do niej dostępu.',
        [{ text: 'Wróć', onPress: () => router.replace('/') }],
      );
    }
  }, [trailId, trailStatus, venue.source, router]);

  // B29: pass intent into useRealRun. Default to 'practice' when the
  // redirect effect is about to fire (intent === null) so the hook can
  // still mount cleanly for the one render cycle before replace() runs —
  // no ranked side-effects fire in that window because the redirect is
  // synchronous-enough and ApproachView's onArm path is the only thing
  // that could transition out of idle.
  const resolvedIntent = resolveHookIntent(intent);
  const {
    state,
    beginReadinessCheck,
    armRun,
    startRun,
    manualStart,
    finishRun,
    cancel,
  } = useRealRun(trailId, trailName, spotId, resolvedIntent, geo, gateConfig, profile?.id);

  // Ranked background-permission preflight (F1#6). iOS silently kills
  // foreground-only GPS when the phone screen locks or the app is
  // pocketed — a ranked timer started without "Always" location will
  // die mid-run and burn the rider's attempt. We force the Always ask
  // at arm time so the rider is either opted-in or consciously chooses
  // practice. No silent foreground-only ranked runs.
  const permission = useLocationPermission();

  // Codex P1.1: when the Alert deep-links the rider to Settings and
  // they flip Always → on, nothing re-reads the status on return.
  // Without this listener the UI stays stuck in the denied branch
  // until remount, and a second arm tap triggers a pointless prompt.
  // Refresh on every foreground transition — it's a cheap
  // Location.getBackgroundPermissionsAsync call.
  const refreshPermission = permission.refresh;
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshPermission();
      }
    });
    return () => sub.remove();
  }, [refreshPermission]);

  const armRankedWithPreflight = useCallback(async () => {
    if (permission.backgroundStatus === 'granted') {
      armRun();
      return;
    }
    const result = permission.backgroundStatus === 'undetermined'
      ? await permission.requestBackground()
      : permission.backgroundStatus;
    if (result === 'granted') {
      armRun();
      return;
    }
    // B29: denied (or denied-after-prompt). No silent practice fallback
    // here — the rider chose Ranking at the trail detail, we must honor
    // that. Two honest paths only: flip the permission in iOS Settings,
    // or cancel and go back to the trail detail to switch to Trening
    // explicitly. Product-owner direction post-B28: "nothing can flip.
    // Training should be a separate flow."
    Alert.alert(
      'Potrzebna zgoda „Zawsze"',
      'Ranking wymaga nagrywania GPS gdy telefon jest w kieszeni. Wróć do trasy i wybierz Trening, albo włącz „Zawsze" w Ustawieniach.',
      [
        {
          text: 'Ustawienia',
          onPress: () => { void Linking.openSettings(); },
        },
        {
          text: 'Wróć do trasy',
          onPress: () => {
            cancel();
            router.replace({ pathname: '/trail/[id]', params: { id: trailId } });
          },
        },
        { text: 'Anuluj', style: 'cancel' },
      ],
    );
  }, [permission, armRun, cancel, router, trailId]);

  // ── Gaming context: user PB + rival above (Chunk 5) ─────────
  //
  // Reuses existing fetch paths — useUserTrailStats for the PB map,
  // useLeaderboard top-50 for the rival lookup. No new queries. Both
  // fetches are async and non-blocking; the MotivationStack simply
  // fills in when data arrives. Rival gap uses static PB-vs-PB delta
  // (matches trail/[id].tsx semantics; simpler cognitive load mid-ride
  // than a live-counting gap).
  const { stats: userTrailStats } = useUserTrailStats(profile?.id);
  const { entries: leaderboardEntries } = useLeaderboard(trailId, 'all_time', profile?.id);

  const userPbMs = userTrailStats.get(trailId)?.pbMs ?? null;
  const userEntry = leaderboardEntries.find((e) => e.isCurrentUser) ?? null;
  const userRank = userEntry?.currentPosition ?? null;
  const rivalEntry = userEntry
    ? leaderboardEntries.find((e) => e.currentPosition === userEntry.currentPosition - 1) ?? null
    : null;
  const rivalAbove: RivalAbove = rivalEntry && userEntry
    ? {
        username: rivalEntry.username,
        rank: rivalEntry.currentPosition,
        gapMs: userEntry.bestDurationMs - rivalEntry.bestDurationMs,
      }
    : null;

  // Triple-tap trail name to toggle debug — dev builds only.
  // In production this is a no-op so reviewers can't surface
  // the debug overlay accidentally.
  const handleDebugTap = useCallback(() => {
    if (!__DEV__) return;
    const newTaps = debugTaps + 1;
    setDebugTaps(newTaps);
    if (newTaps >= 3) {
      setShowDebug((s) => !s);
      setDebugTaps(0);
    }
    if (debugTapTimerRef.current) clearTimeout(debugTapTimerRef.current);
    debugTapTimerRef.current = setTimeout(() => setDebugTaps(0), 800);
  }, [debugTaps]);

  useEffect(() => {
    return () => {
      if (debugTapTimerRef.current) clearTimeout(debugTapTimerRef.current);
    };
  }, []);

  const handleTap = () => {
    switch (state.phase) {
      case 'idle':
        tapLight();
        beginReadinessCheck();
        break;
      case 'readiness_check':
        // B21: when ApproachView is showing, arming must be explicit —
        // tapping anywhere on screen used to auto-arm ranked, which B20
        // field testers did by accident while fumbling with the phone
        // walking up to the gate. The UZBRÓJ button inside ApproachView
        // is the only sanctioned path; whole-screen taps become no-ops.
        // The legacy ReadinessPanel branch (no GPS fix or no gate
        // config) still needs a tap to progress, so we only suppress
        // when showApproachPreRun is truthy.
        if (showApproachPreRun) {
          break;
        }
        // B29: intent is immutable — branch on intent, not on readiness
        // flags. The readiness flags can flicker mid-tap (B28 bug), so
        // using them to pick mode silently demoted ranked → practice.
        // Now the rider's intent is the pin; readiness only gates
        // whether we arm now or wait.
        if (intent === 'practice') {
          if (state.readiness.ctaEnabled) {
            tapLight();
            armRun();
          }
          break;
        }
        // intent === 'ranked' from here. Auth wall is upstream
        // (bootstrap → /auth → /(tabs) → /run/active is unreachable
        // without a session), so no inline auth check needed.
        if (state.readiness.rankedEligible) {
          tapMedium();
          void armRankedWithPreflight();
        }
        // Ranked intent but not rankedEligible → no-op. Rider sees the
        // readiness copy ("za daleko od linii", "GPS słaby") and waits
        // or taps WRÓĆ. No silent fallback to practice — that's the
        // whole B29 contract.
        break;
      case 'armed_ranked':
        break;
      case 'armed_practice':
        tapHeavy();
        startRun();
        break;
      case 'running_ranked':
        // Auto-started ranked runs must cross the real finish gate —
        // no manual bailout, keeps the leaderboard honest. Manual-
        // started ranked runs (no gateAutoStarted flag) are already
        // flagged non-leaderboard by assessQuality, so letting the
        // rider tap to stop the timer is the same semantic as the
        // running_practice path below.
        if (!state.gateAutoStarted) {
          tapHeavy();
          finishRun();
        }
        break;
      case 'running_practice':
        tapHeavy();
        finishRun();
        break;
      case 'completed_verified':
        notifySuccess();
        navigateToResult();
        break;
      case 'completed_unverified':
        notifyWarning();
        navigateToResult();
        break;
      case 'invalidated':
        notifyError();
        navigateToResult();
        break;
    }
  };

  const navigateToResult = () => {
    // Pass only the session ID — result screen reads truth from the store
    router.replace({
      pathname: '/run/result',
      params: { runSessionId: state.runSessionId },
    });
  };

  const doCancelAndExit = () => {
    cancel();
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleCancel = () => {
    // Mid-ride cancel — confirm destructively. Without this guard a
    // misclick on the small ghost button in the corner would abort
    // a clean run with no recovery (raw points stay on disk for
    // forensics, but the result screen is gone).
    if (state.phase === 'running_ranked' || state.phase === 'running_practice') {
      Alert.alert(
        'Przerwać zjazd?',
        'Czas zostanie odrzucony, zjazd nie zostanie zapisany.',
        [
          { text: 'Jadę dalej', style: 'cancel' },
          { text: 'Przerwij', style: 'destructive', onPress: doCancelAndExit },
        ],
      );
      return;
    }
    doCancelAndExit();
  };

  const handleStartPractice = () => {
    // B29: armRun() is parameterless and reads intent from the hook
    // closure. This handler is only wired up when intent === 'practice'
    // (see ReadinessPanel render below), so calling armRun() here is
    // always a practice arm. If intent were somehow 'ranked' at this
    // point it would be a bug, not a silent demotion — the gating lives
    // in the prop wiring, not inside armRun.
    tapLight();
    armRun();
  };

  const handleBack = () => {
    handleCancel();
  };

  // Phase display
  const phaseLabel = (() => {
    switch (state.phase) {
      case 'idle': return 'SPRAWDŹ GOTOWOŚĆ';
      case 'readiness_check':
        if (state.permissionDenied) return 'WŁĄCZ LOKALIZACJĘ';
        if (state.readiness.rankedEligible) return state.readiness.ctaLabel;
        if (state.readiness.ctaEnabled) return state.readiness.ctaLabel;
        return state.readiness.ctaLabel;
      case 'armed_ranked': return isTrainingOnly ? 'TRENING — CZEKAM NA START' : 'UZBROJONY — CZEKAM NA LINIĘ';
      case 'armed_practice': return 'TRENING — START';
      case 'running_ranked': return 'ZJAZD RANKINGOWY';
      case 'running_practice': return 'ZJAZD TRENINGOWY';
      case 'finishing': return 'META…';
      case 'verifying': return 'SPRAWDZAM…';
      case 'completed_verified': return '✓ ZALICZONY';
      case 'completed_unverified': return 'ZAPISANY';
      case 'invalidated': return 'NIE ZALICZONY';
      case 'error': return state.error ?? 'BŁĄD';
      default: return '';
    }
  })();

  // Pattern 2 — Race-state owns color. Acid palette only:
  //   armed / verified  → accent green (ranked, on-line)
  //   pending           → warn amber  (validating: finishing / verifying)
  //   invalid           → danger red  (DNF / DSQ / invalidated)
  //   training          → textPrimary (practice mode active)
  //   training settled  → textSecondary (saved but not ranked)
  // Older revisions reached for `colors.blue` (Arctic palette) and
  // `colors.gold` (podium) for practice / verifying respectively —
  // both are palette-mixes that broke the canonical thread.
  const phaseColor = (() => {
    switch (state.phase) {
      case 'idle': return colors.textPrimary;
      case 'readiness_check':
        return state.readiness.rankedEligible ? colors.accent :
               state.readiness.ctaEnabled ? colors.textPrimary : colors.textTertiary;
      case 'armed_ranked': return colors.accent;
      case 'armed_practice': return colors.textPrimary;
      case 'running_ranked': return colors.accent;
      case 'running_practice': return colors.textPrimary;
      case 'finishing': case 'verifying': return colors.warn;
      case 'completed_verified': return colors.accent;
      case 'completed_unverified': return colors.textSecondary;
      case 'invalidated': return colors.danger;
      default: return colors.textSecondary;
    }
  })();

  const running = state.phase === 'running_ranked' || state.phase === 'running_practice';
  const showTimer = running || state.phase === 'finishing' || state.phase === 'verifying'
    || state.phase === 'completed_verified' || state.phase === 'completed_unverified' || state.phase === 'invalidated';
  // Cancel is also available DURING the run, gated by an Alert confirm
  // in handleCancel. Without this, a ranked run with auto-start gate
  // detection had no exit path — if the rider abandoned mid-trail or
  // GPS lost the finish gate, the timer just kept ticking forever.
  const showCancel = state.phase === 'idle' || state.phase === 'readiness_check'
    || state.phase === 'armed_ranked' || state.phase === 'armed_practice'
    || state.phase === 'running_ranked' || state.phase === 'running_practice';

  // Chunk 10: Approach Navigator replaces the legacy ReadinessPanel when
  // we have a real GPS fix + a Pioneer gate config. Without either we
  // fall back to ReadinessPanel so the user still sees the copy that
  // covers permission-denied / no-geometry edge cases.
  const canShowApproach =
    !!gateConfig && !!state.lastPoint && !state.permissionDenied;
  const showApproachPreRun =
    canShowApproach &&
    (state.phase === 'readiness_check' ||
      state.phase === 'armed_ranked' ||
      state.phase === 'armed_practice');
  const showReadiness = state.phase === 'readiness_check' && !showApproachPreRun;

  // FAZA 2 #1: memoize userPosition + approachState so ApproachView's
  // memo guard can actually short-circuit when the rider is stationary.
  // Without this, every parent render (e.g. from the 1Hz timer) produced
  // a new userPosition object identity and forced ApproachView to
  // re-render its map + body even when lat/lng hadn't moved.
  const userPosition = useMemo(
    () =>
      state.lastPoint
        ? { latitude: state.lastPoint.latitude, longitude: state.lastPoint.longitude }
        : null,
    [state.lastPoint?.latitude, state.lastPoint?.longitude],
  );

  const userVelocityMps =
    state.gateSpeedKmh != null ? state.gateSpeedKmh / 3.6 : (state.lastPoint?.speed ?? 0);

  const approachState = useMemo(
    () =>
      showApproachPreRun && userPosition && gateConfig
        ? computeApproachState({
            userPosition,
            // GpsPoint does not carry heading; the gate engine already
            // derives it from the last two buffered points. Speed is the
            // same story — prefer the derived gateSpeedKmh (converted to
            // m/s) over raw .speed which can lag on fresh fixes.
            userHeading: state.gateHeadingDeg,
            userAccuracyM: state.lastPoint?.accuracy ?? 99,
            userVelocityMps,
            trailGate: gateConfig,
          })
        : null,
    [
      showApproachPreRun,
      userPosition,
      gateConfig,
      state.gateHeadingDeg,
      state.lastPoint?.accuracy,
      userVelocityMps,
    ],
  );

  // B29: badge reads intent, not state.mode — same value (makeInitialState
  // pins mode to intent) but sourcing from intent makes the invariant
  // self-documenting. Canonical Pill states: ranked → armed (accent),
  // practice → training (muted) per § 01 race-state-owns-color.
  const modePillState: 'armed' | 'training' = intent === 'ranked' ? 'armed' : 'training';
  const modePillLabel = intent === 'ranked' ? 'RANKING' : 'TRENING';

  return (
    <SafeAreaView style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={phaseLabel}
        style={styles.fullscreen}
        onPress={handleTap}
      >
        {/* Trail name (triple-tap for debug) */}
        <Pressable onPress={handleDebugTap}>
          <Text style={styles.trailName}>{trailName.toUpperCase()}</Text>
        </Pressable>

        {/* Mode badge — canonical Pill */}
        {state.phase !== 'idle' && (
          <View style={styles.modeBadgeWrap}>
            <Pill state={modePillState} size="sm">{modePillLabel}</Pill>
          </View>
        )}

        {/* Readiness panel — legacy path. Still used when we have no GPS fix
            yet, permission was denied, or the trail has no Pioneer gate
            config (ApproachView needs all three to render honestly). */}
        {showReadiness && (
          <View style={styles.readinessContainer}>
            <ReadinessPanel
              readiness={state.readiness}
              // B29: only show "Jedź jako trening" when rider's intent
              // was already practice. If intent === 'ranked' we never
              // surface a practice button here — silent demotion is
              // off the table. The rider's options in that case are:
              // wait for GPS/gate, or tap WRÓĆ (handleBack).
              onStartPractice={intent === 'practice' ? handleStartPractice : undefined}
              onBack={handleBack}
            />
          </View>
        )}

        {/* Approach Navigator — Chunk 10. Renders only when we have a live
            GPS fix + a real gate config so the 5-state machine can produce
            truthful guidance. Wrapped in absolute-fill so it overlays the
            default phase indicator / timer below it. */}
        {showApproachPreRun && approachState ? (
          <View style={styles.approachContainer}>
            <ApproachView
              trailName={trailName}
              mode={intent === 'ranked' ? 'ranked' : 'training'}
              state={approachState}
              userAccuracyM={state.lastPoint?.accuracy ?? 99}
              userVelocityMps={
                state.gateSpeedKmh != null
                  ? state.gateSpeedKmh / 3.6
                  : (state.lastPoint?.speed ?? 0)
              }
              userHeading={state.gateHeadingDeg}
              startPoint={gateConfig?.startGate.center ?? null}
              userPosition={userPosition}
              onManualStart={manualStart}
              onArm={() => {
                // B29: intent is the immutable oracle — readiness only
                // gates whether we can arm *now*. Practice intent arms
                // immediately (it's a practice run, by definition).
                // Ranked intent honours the pre-existing auth +
                // rankedEligible checks but NEVER silently demotes to
                // practice on failure — the rider committed to ranked
                // at trail detail, and silent demotion is the exact
                // B28 bug this refactor kills.
                if (intent === 'practice') {
                  armRun();
                  return;
                }
                // intent === 'ranked'. Auth wall upstream — no inline check.
                if (state.readiness.rankedEligible) {
                  void armRankedWithPreflight();
                  return;
                }
                // Ranked intent but gate / GPS says not yet. Be honest
                // about why — no silent practice armament.
                Alert.alert(
                  'Jeszcze nie teraz',
                  'Podejdź bliżej linii startu i odczekaj, aż GPS wyostrzy pozycję. Ranking wymaga dokładności na linii.',
                  [{ text: 'OK' }],
                );
              }}
              armed={
                state.phase === 'armed_ranked' || state.phase === 'armed_practice'
              }
              // onBack intentionally omitted: active.tsx renders its own
              // "← WRÓĆ" (styles.cancelBtn below) during the same phases
              // ApproachView covers. Passing onBack here rendered a second
              // WRÓĆ on top of the parent's.
            />
          </View>
        ) : null}

        {/* Phase indicator */}
        <View style={[styles.phaseIndicator, { borderColor: phaseColor }]}>
          <Text style={[styles.phaseText, { color: phaseColor }]}>
            {phaseLabel}
          </Text>
        </View>

        {/* Timer — canonical RaceTime hero (56px). Pre-canonical hand-tuned
            72px reduced to design-system spec; tabular-nums + dimMs comes
            for free. Phase-tinted via wrapping View since RaceTime atom
            does not expose a colour override on the hero glyph. */}
        <View style={[styles.timerWrap, showTimer && { opacity: 1 }]}>
          <RaceTime
            value={showTimer ? formatTime(state.elapsedMs) : '00.00'}
            size="hero"
            dimMs
          />
        </View>

        {/* Gaming-context cards — delta-to-PB + rival / king state */}
        {running && (
          <MotivationStack
            elapsedMs={state.elapsedMs}
            userPbMs={userPbMs}
            rivalAbove={rivalAbove}
            userRank={userRank}
            variant="rider"
          />
        )}

        {/* Live stats during run */}
        {running && (
          <View style={styles.liveStats}>
            <Text style={styles.liveStat}>
              {state.checkpoints.filter((c) => c.passed).length}/{state.checkpoints.length} CP
            </Text>
            <Text style={styles.liveStat}>
              {state.gateTotalDistanceM > 0 ? `${Math.round(state.gateTotalDistanceM)}m` : `${state.pointCount} pts`}
            </Text>
            <Text style={[styles.liveStat, {
              color: state.gps.readiness === 'good' || state.gps.readiness === 'excellent'
                ? colors.accent : colors.orange
            }]}>
              GPS {state.gps.readiness === 'excellent' ? '●●●' :
                   state.gps.readiness === 'good' ? '●●○' :
                   state.gps.readiness === 'weak' ? '●○○' : '○○○'}
            </Text>
            {state.gateSpeedKmh !== null && state.gateSpeedKmh > 0.5 && (
              <Text style={styles.liveStat}>
                {Math.round(state.gateSpeedKmh)} km/h
              </Text>
            )}
          </View>
        )}

        {/* Tap instruction */}
        {!showTimer && state.phase === 'idle' && (
          <Text style={styles.instruction}>DOTKNIJ EKRAN</Text>
        )}
        {state.phase === 'armed_ranked' && (
          <Text style={styles.instruction}>SCHOWAJ TELEFON I JEDŹ{'\n'}Timer ruszy po przecięciu linii startu</Text>
        )}
        {state.phase === 'armed_practice' && (
          <Text style={styles.instruction}>SCHOWAJ TELEFON I JEDŹ{'\n'}Timer ruszy po przecięciu linii — dotknij jeśli nie zareaguje</Text>
        )}
        {state.phase === 'running_ranked' && (
          <Text style={styles.instruction}>
            {state.gateAutoStarted
              ? 'META ZALICZA SIĘ NA LINII KOŃCA'
              : 'TRYB RĘCZNY — DOTKNIJ, ABY ZAKOŃCZYĆ'}
          </Text>
        )}
        {state.phase === 'running_practice' && (
          <Text style={styles.instruction}>DOTKNIJ, ABY ZAKOŃCZYĆ</Text>
        )}
        {(state.phase === 'completed_verified' || state.phase === 'completed_unverified' || state.phase === 'invalidated') && (
          <Text style={styles.instruction}>DOTKNIJ — WYNIK</Text>
        )}
      </Pressable>

      {/* Cancel — canonical Btn ghost with arrow-left glyph.
          Label switches to "Przerwij" once the timer is running so
          riders know it'll abort their attempt, not just navigate away. */}
      {showCancel && (
        <View style={styles.cancelWrap}>
          <Btn
            variant="ghost"
            size="sm"
            fullWidth={false}
            icon={<IconGlyph name="arrow-left" size={14} color={colors.textTertiary} />}
            onPress={handleCancel}
          >
            {state.phase === 'running_ranked' || state.phase === 'running_practice'
              ? 'Przerwij'
              : 'Wróć'}
          </Btn>
        </View>
      )}

      {/* Debug overlay — dev builds only */}
      {__DEV__ && showDebug && <DebugOverlay state={state} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fullscreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  trailName: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    letterSpacing: 3,
  },
  modeBadgeWrap: {
    marginBottom: spacing.xl,
  },
  readinessContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  approachContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  phaseIndicator: {
    width: '88%',
    minHeight: 48,
    borderWidth: 2,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseText: {
    ...typography.label,
    fontSize: 12,
    lineHeight: 15,
    letterSpacing: 2.4,
    textAlign: 'center',
    flexShrink: 1,
  },
  timerWrap: {
    opacity: 0.6,
  },
  liveStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  liveStat: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 1,
  },
  instruction: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xxxl,
    letterSpacing: 2,
    textAlign: 'center',
    fontSize: 11,
  },
  cancelWrap: {
    position: 'absolute',
    bottom: spacing.xxxl,
    alignSelf: 'center',
  },
});
