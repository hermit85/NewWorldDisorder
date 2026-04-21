import { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, AppState } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { formatTime } from '@/content/copy';
import { useRealRun } from '@/systems/useRealRun';
import { ReadinessPanel } from '@/components/run/ReadinessPanel';
import { DebugOverlay } from '@/components/run/DebugOverlay';
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

  const { profile, isAuthenticated } = useAuthContext();

  // Resolve venue for this trail. getVenueForTrail still exists but
  // the registry is empty after Checkpoint B — so venueMatch is null
  // in the common case. We fall back to DB for the parent spot id.
  const venueMatch = getVenueForTrail(trailId);
  const { trail: dbTrail } = useTrail(trailId || null);
  const spotId = venueMatch?.venueId ?? dbTrail?.spotId ?? '';
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

  // ── Background detection: warn rider if GPS may have gaps ──
  const [bgWarning, setBgWarning] = useState(false);
  const wasBackgroundedRef = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const running = state.phase === 'running_ranked' || state.phase === 'running_practice';
      if (nextState !== 'active' && running) {
        wasBackgroundedRef.current = true;
      }
      if (nextState === 'active' && wasBackgroundedRef.current && running) {
        setBgWarning(true);
        wasBackgroundedRef.current = false;
      }
    });
    return () => subscription.remove();
  }, [state.phase]);

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
    setTimeout(() => setDebugTaps(0), 800);
  }, [debugTaps]);

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
  const showReadiness = state.phase === 'readiness_check';

  const modeBadge = state.mode === 'ranked'
    ? { label: 'RANKING', color: colors.accent, bg: colors.accentDim }
    : { label: 'TRENING', color: colors.blue, bg: 'rgba(0, 122, 255, 0.15)' };

  return (
    <SafeAreaView style={styles.container}>
      <Pressable style={styles.fullscreen} onPress={handleTap}>
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

        {/* Readiness panel — with fallback actions */}
        {showReadiness && (
          <View style={styles.readinessContainer}>
            <ReadinessPanel
              readiness={state.readiness}
              onStartPractice={!state.readiness.rankedEligible ? handleStartPractice : undefined}
              onBack={handleBack}
            />
          </View>
        )}

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
          <Text style={styles.instruction}>DOTKNIJ, ABY RUSZYĆ{'\n'}Meta może zakończyć się automatycznie</Text>
        )}
        {state.phase === 'running_ranked' && (
          <Text style={styles.instruction}>META ZALICZA SIĘ NA LINII KOŃCA</Text>
        )}
        {state.phase === 'running_practice' && (
          <Text style={styles.instruction}>DOTKNIJ, ABY ZAKOŃCZYĆ</Text>
        )}
        {(state.phase === 'completed_verified' || state.phase === 'completed_unverified' || state.phase === 'invalidated') && (
          <Text style={styles.instruction}>DOTKNIJ — WYNIK</Text>
        )}
      </Pressable>

      {/* Background warning */}
      {bgWarning && (
        <Pressable style={styles.bgWarning} onPress={() => setBgWarning(false)}>
          <Text style={styles.bgWarningText}>
            Appka była w tle — GPS mógł zgubić punkty. Wynik może nie przejść weryfikacji.
          </Text>
          <Text style={styles.bgWarningDismiss}>ZAMKNIJ</Text>
        </Pressable>
      )}

      {/* Cancel */}
      {showCancel && (
        <Pressable style={styles.cancelBtn} onPress={handleCancel}>
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
  bgWarning: {
    position: 'absolute',
    top: 50,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    zIndex: 10,
  },
  bgWarningText: {
    ...typography.bodySmall,
    color: colors.orange,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xs,
  },
  bgWarningDismiss: {
    ...typography.labelSmall,
    color: colors.orange,
    letterSpacing: 2,
  },
});
