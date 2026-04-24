import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { formatTime } from '@/content/copy';
import { useRealRun } from '@/systems/useRealRun';
import { ReadinessPanel } from '@/components/run/ReadinessPanel';
import { ApproachView } from '@/components/run/ApproachView';
import { DebugOverlay } from '@/components/run/DebugOverlay';
import { computeApproachState } from '@/features/run/approachNavigator';
import { getVenueForTrail } from '@/data/venues';
import { tapLight, tapMedium, tapHeavy, notifySuccess, notifyWarning, notifyError } from '@/systems/haptics';
import { useAuthContext } from '@/hooks/AuthContext';
import { useTrail, useTrailGeometry, useUserTrailStats, useLeaderboard } from '@/hooks/useBackend';
import { buildTrailGeoFromPioneer } from '@/features/run/gates';
import { buildTrailGateConfigFromPioneer } from '@/features/run';
import { MotivationStack, type RivalAbove } from '@/components/run/MotivationStack';

export default function ActiveRunScreen() {
  const { trailId = '', trailName = 'Unknown Trail' } =
    useLocalSearchParams<{ trailId: string; trailName: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [showDebug, setShowDebug] = useState(false);
  const [debugTaps, setDebugTaps] = useState(0);
  const debugTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { profile, isAuthenticated } = useAuthContext();

  // Resolve venue for this trail. getVenueForTrail still exists but
  // the registry is empty after Checkpoint B — so venueMatch is null
  // in the common case. We fall back to DB for the parent spot id.
  const venueMatch = getVenueForTrail(trailId);
  const { trail: dbTrail, status: trailStatus } = useTrail(trailId || null);
  const spotId = venueMatch?.venueId ?? dbTrail?.spotId ?? '';

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
    if (!venueMatch && trailStatus === 'empty') {
      guardedRef.current = true;
      Alert.alert(
        'Trasa nie istnieje',
        'Ta trasa została usunięta lub nie masz do niej dostępu.',
        [{ text: 'Wróć', onPress: () => router.replace('/') }],
      );
    }
  }, [trailId, trailStatus, venueMatch, router]);
  const isTrainingOnly = venueMatch ? !venueMatch.venue.rankingEnabled : false;

  // Rehydrate trail geo from Pioneer geometry (Sprint 3 Chunk 6).
  // 1st preference: hardcoded venueMatch (Słotwiny legacy). Falls back
  // to the Pioneer line persisted on trails.geometry. If the trail is
  // still a draft (no Pioneer yet), geo stays null → gate engine runs
  // with no corridor → ranked runs finalise as 'unverified'.
  const { geometry: pioneerGeometryRaw } = useTrailGeometry(
    venueMatch ? null : (trailId || null),
  );
  const geo = venueMatch
    ? (venueMatch.venue.trailGeo.find((g: { trailId: string }) => g.trailId === trailId) ?? null)
    : buildTrailGeoFromPioneer(trailId || null, pioneerGeometryRaw);
  const gateConfig = venueMatch
    ? (geo ? buildTrailGateConfigFromPioneer(trailId || '', trailName, {
        version: 1,
        points: geo.polyline.map((p, i) => ({ lat: p.latitude, lng: p.longitude, t: i })),
        meta: {
          totalDistanceM: 0,
          totalDescentM: 0,
          durationS: 0,
          medianAccuracyM: 0,
        },
      }) : null)
    : buildTrailGateConfigFromPioneer(trailId || null, trailName, pioneerGeometryRaw);

  const {
    state,
    beginReadinessCheck,
    armRun,
    startRun,
    manualStart,
    finishRun,
    cancel,
  } = useRealRun(trailId, trailName, spotId, geo, gateConfig, profile?.id);

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
        if (isTrainingOnly) {
          // Training-only venue: always practice, never ranked
          tapLight();
          armRun('practice');
        } else if (state.readiness.rankedEligible && isAuthenticated) {
          tapMedium();
          armRun('ranked');
        } else if (state.readiness.rankedEligible && !isAuthenticated) {
          tapLight();
          router.push('/auth');
        } else if (state.readiness.ctaEnabled) {
          tapLight();
          armRun('practice');
        }
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

  const handleCancel = () => {
    cancel();
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const handleStartPractice = () => {
    tapLight();
    armRun('practice');
  };

  const handleBack = () => {
    handleCancel();
  };

  // Phase display
  const phaseLabel = (() => {
    switch (state.phase) {
      case 'idle': return 'DOTKNIJ — SPRAWDŹ GOTOWOŚĆ';
      case 'readiness_check':
        if (state.permissionDenied) return 'WŁĄCZ LOKALIZACJĘ';
        if (state.readiness.rankedEligible) return state.readiness.ctaLabel;
        if (state.readiness.ctaEnabled) return state.readiness.ctaLabel;
        return state.readiness.ctaLabel;
      case 'armed_ranked': return isTrainingOnly ? 'TRENING — CZEKAM NA START' : 'UZBROJONY — CZEKAM NA LINIĘ';
      case 'armed_practice': return 'TRENING — DOTKNIJ ABY START';
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

  const phaseColor = (() => {
    switch (state.phase) {
      case 'idle': return colors.textPrimary;
      case 'readiness_check':
        return state.readiness.rankedEligible ? colors.accent :
               state.readiness.ctaEnabled ? colors.blue : colors.textTertiary;
      case 'armed_ranked': return colors.accent;
      case 'armed_practice': return colors.blue;
      case 'running_ranked': return colors.accent;
      case 'running_practice': return colors.blue;
      case 'finishing': case 'verifying': return colors.gold;
      case 'completed_verified': return colors.accent;
      case 'completed_unverified': return colors.blue;
      case 'invalidated': return colors.red;
      default: return colors.textSecondary;
    }
  })();

  const running = state.phase === 'running_ranked' || state.phase === 'running_practice';
  const showTimer = running || state.phase === 'finishing' || state.phase === 'verifying'
    || state.phase === 'completed_verified' || state.phase === 'completed_unverified' || state.phase === 'invalidated';
  const showCancel = state.phase === 'idle' || state.phase === 'readiness_check'
    || state.phase === 'armed_ranked' || state.phase === 'armed_practice';

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

  const approachState =
    showApproachPreRun && state.lastPoint && gateConfig
      ? computeApproachState({
          userPosition: {
            latitude: state.lastPoint.latitude,
            longitude: state.lastPoint.longitude,
          },
          // GpsPoint does not carry heading; the gate engine already
          // derives it from the last two buffered points. Speed is the
          // same story — prefer the derived gateSpeedKmh (converted to
          // m/s) over raw .speed which can lag on fresh fixes.
          userHeading: state.gateHeadingDeg,
          userAccuracyM: state.lastPoint.accuracy ?? 99,
          userVelocityMps:
            state.gateSpeedKmh != null ? state.gateSpeedKmh / 3.6 : (state.lastPoint.speed ?? 0),
          trailGate: gateConfig,
        })
      : null;

  const modeBadge = state.mode === 'ranked'
    ? { label: 'RANKING', color: colors.accent, bg: colors.accentDim }
    : { label: 'TRENING', color: colors.blue, bg: 'rgba(0, 122, 255, 0.15)' };

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

        {/* Mode badge */}
        {state.phase !== 'idle' && (
          <View style={[styles.modeBadge, { backgroundColor: modeBadge.bg }]}>
            <Text style={[styles.modeBadgeText, { color: modeBadge.color }]}>
              {modeBadge.label}
            </Text>
          </View>
        )}

        {/* Readiness panel — legacy path. Still used when we have no GPS fix
            yet, permission was denied, or the trail has no Pioneer gate
            config (ApproachView needs all three to render honestly). */}
        {showReadiness && (
          <View style={styles.readinessContainer}>
            <ReadinessPanel
              readiness={state.readiness}
              onStartPractice={!state.readiness.rankedEligible ? handleStartPractice : undefined}
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
              mode={isTrainingOnly ? 'training' : (state.mode === 'practice' ? 'training' : 'ranked')}
              state={approachState}
              userAccuracyM={state.lastPoint?.accuracy ?? 99}
              userVelocityMps={
                state.gateSpeedKmh != null
                  ? state.gateSpeedKmh / 3.6
                  : (state.lastPoint?.speed ?? 0)
              }
              userHeading={state.gateHeadingDeg}
              startPoint={gateConfig?.startGate.center ?? null}
              userPosition={
                state.lastPoint
                  ? {
                      latitude: state.lastPoint.latitude,
                      longitude: state.lastPoint.longitude,
                    }
                  : null
              }
              onManualStart={manualStart}
              onArm={() => {
                // Ranked-vs-practice is decided from venue / auth /
                // readiness, never from `state.mode` — `mode` defaults
                // to 'practice' on a fresh useRealRun, so reading it
                // here silently demoted every fresh ranked attempt into
                // practice (Codex review P0.1, pre-B21).
                const canRank =
                  !isTrainingOnly &&
                  isAuthenticated &&
                  state.readiness.rankedEligible;
                armRun(canRank ? 'ranked' : 'practice');
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

        {/* Timer */}
        <Text style={[styles.timer, showTimer && { color: phaseColor }]}>
          {showTimer ? formatTime(state.elapsedMs) : '00.00'}
        </Text>

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

{/* Cancel */}
      {showCancel && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          style={styles.cancelBtn}
          onPress={handleCancel}
        >
          <Text style={styles.cancelText}>← WRÓĆ</Text>
        </Pressable>
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
  modeBadge: {
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
    marginBottom: spacing.xl,
  },
  modeBadgeText: {
    ...typography.labelSmall,
    letterSpacing: 3,
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
    borderWidth: 2,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    marginBottom: spacing.xxl,
  },
  phaseText: {
    ...typography.label,
    fontSize: 14,
    letterSpacing: 3,
    textAlign: 'center',
  },
  timer: {
    ...typography.timeHero,
    color: colors.textPrimary,
    fontSize: 72,
    letterSpacing: 4,
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
  cancelBtn: {
    position: 'absolute',
    bottom: spacing.xxxl,
    alignSelf: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cancelText: {
    ...typography.label,
    color: colors.textTertiary,
  },
});
