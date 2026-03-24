import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { formatTime, copy } from '@/content/copy';
import { useRealRun } from '@/systems/useRealRun';
import { ReadinessPanel } from '@/components/run/ReadinessPanel';
import { DebugOverlay } from '@/components/run/DebugOverlay';
import { getTrailGeo } from '@/data/seed/slotwinyMap';
import { isRunning, isArmed } from '@/systems/runMachine';

export default function ActiveRunScreen() {
  const { trailId = 'dzida-czerwona', trailName = 'Dzida Czerwona' } =
    useLocalSearchParams<{ trailId: string; trailName: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [showDebug, setShowDebug] = useState(false);
  const [debugTaps, setDebugTaps] = useState(0);

  const geo = getTrailGeo(trailId) ?? null;

  const {
    state,
    beginReadinessCheck,
    armRun,
    startRun,
    finishRun,
    cancel,
  } = useRealRun(trailId, trailName, geo);

  // Triple-tap trail name to toggle debug
  const handleDebugTap = useCallback(() => {
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
        beginReadinessCheck();
        break;
      case 'readiness_check':
        if (state.readiness.rankedEligible) {
          armRun('ranked');
        } else if (state.readiness.ctaEnabled) {
          armRun('practice');
        }
        break;
      case 'armed_ranked':
      case 'armed_practice':
        startRun();
        break;
      case 'running_ranked':
      case 'running_practice':
        finishRun();
        break;
      case 'completed_verified':
      case 'completed_unverified':
      case 'invalidated': {
        // Navigate to result
        const v = state.verification;
        router.replace({
          pathname: '/run/result',
          params: {
            scenarioId: 'new-pb', // fallback scenario for display
            actualTimeMs: String(state.elapsedMs),
            verificationId: v?.status === 'verified' ? 'verifiedClean' :
                            v?.status === 'practice_only' ? 'practiceRun' :
                            v?.status === 'weak_signal' ? 'weakSignal' :
                            v?.status === 'missing_checkpoint' ? 'missingCheckpoint' :
                            v?.status === 'shortcut_detected' ? 'shortcutDetected' :
                            'outsideStartGate',
            mode: state.mode,
          },
        });
        break;
      }
    }
  };

  const handleCancel = () => {
    cancel();
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  // Phase display
  const phaseLabel = (() => {
    switch (state.phase) {
      case 'idle': return 'TAP TO CHECK READINESS';
      case 'readiness_check':
        if (state.permissionDenied) return 'LOCATION REQUIRED';
        return state.readiness.ctaLabel;
      case 'armed_ranked': return 'RANKED — TAP TO START';
      case 'armed_practice': return 'PRACTICE — TAP TO START';
      case 'running_ranked': return 'RANKED RUN';
      case 'running_practice': return 'PRACTICE RUN';
      case 'finishing': return 'FINISHING...';
      case 'verifying': return 'VERIFYING...';
      case 'completed_verified': return 'VERIFIED — TAP TO CONTINUE';
      case 'completed_unverified': return 'PRACTICE COMPLETE — TAP';
      case 'invalidated': return 'NOT VERIFIED — TAP';
      case 'error': return state.error ?? 'ERROR';
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
    ? { label: 'RANKED', color: colors.accent, bg: colors.accentDim }
    : { label: 'PRACTICE', color: colors.blue, bg: 'rgba(0, 122, 255, 0.15)' };

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

        {/* Readiness panel */}
        {showReadiness && (
          <View style={styles.readinessContainer}>
            <ReadinessPanel readiness={state.readiness} />
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

        {/* Live stats during run */}
        {running && (
          <View style={styles.liveStats}>
            <Text style={styles.liveStat}>
              {state.checkpoints.filter((c) => c.passed).length}/{state.checkpoints.length} CP
            </Text>
            <Text style={styles.liveStat}>
              {state.pointCount} pts
            </Text>
            <Text style={[styles.liveStat, {
              color: state.gps.readiness === 'good' || state.gps.readiness === 'excellent'
                ? colors.accent : colors.orange
            }]}>
              GPS {state.gps.readiness === 'excellent' ? '●●●' :
                   state.gps.readiness === 'good' ? '●●○' :
                   state.gps.readiness === 'weak' ? '●○○' : '○○○'}
            </Text>
          </View>
        )}

        {/* Tap instruction */}
        {!showTimer && (
          <Text style={styles.instruction}>
            {state.phase === 'idle' && 'TAP TO BEGIN'}
            {showReadiness && state.readiness.ctaEnabled && 'TAP TO ARM'}
            {showReadiness && !state.readiness.ctaEnabled && state.readiness.message}
            {(state.phase === 'armed_ranked' || state.phase === 'armed_practice') && 'TAP TO START RUN'}
          </Text>
        )}
        {running && (
          <Text style={styles.instruction}>TAP TO FINISH · or reach finish gate</Text>
        )}
      </Pressable>

      {/* Cancel */}
      {showCancel && (
        <Pressable style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelText}>CANCEL</Text>
        </Pressable>
      )}

      {/* Debug overlay */}
      {showDebug && <DebugOverlay state={state} />}
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
});
