// ═══════════════════════════════════════════════════════════
// Result Screen — reads from shared run store
// Source of truth: runStore (not route params)
// Subscribes to store updates so backend save resolves live
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useReducer } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailById } from '@/data/seed/slotwinyOfficial';
import { XP_TABLE } from '@/systems/xp';
import { formatTime } from '@/content/copy';
import { tapLight, tapHeavy, notifySuccess, notifyWarning } from '@/systems/haptics';
import { getFinalizedRun, subscribeFinalizedRun, updateFinalizedRun, FinalizedRun } from '@/systems/runStore';
import { useAuthContext } from '@/hooks/AuthContext';
import { useResultImpact, ScopeImpact, submitRunToBackend } from '@/hooks/useBackend';
import { logDebugEvent } from '@/systems/debugEvents';
import { triggerRefresh } from '@/hooks/useRefresh';

// ── Verification display config ──
const V_DISPLAY: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  verified:              { label: 'ZWERYFIKOWANO',        color: colors.accent, bg: colors.accentDim,         icon: '✓' },
  practice_only:         { label: 'TRENING',              color: colors.blue,   bg: 'rgba(0,122,255,0.15)',  icon: '○' },
  weak_signal:           { label: 'SŁABY SYGNAŁ',        color: colors.orange, bg: 'rgba(255,149,0,0.15)',  icon: '!' },
  missing_checkpoint:    { label: 'POMINIĘTY CHECKPOINT', color: colors.orange, bg: 'rgba(255,149,0,0.15)',  icon: '!' },
  shortcut_detected:     { label: 'WYKRYTO SKRÓT',       color: colors.red,    bg: 'rgba(255,59,48,0.12)',  icon: '✕' },
  outside_start_gate:    { label: 'BRAK BRAMKI STARTU',  color: colors.red,    bg: 'rgba(255,59,48,0.12)',  icon: '✕' },
  outside_finish_gate:   { label: 'BRAK BRAMKI METY',    color: colors.red,    bg: 'rgba(255,59,48,0.12)',  icon: '✕' },
  invalid_route:         { label: 'BŁĘDNA TRASA',        color: colors.red,    bg: 'rgba(255,59,48,0.12)',  icon: '✕' },
  pending:               { label: 'WERYFIKACJA',         color: colors.gold,   bg: 'rgba(255,204,0,0.12)',  icon: '…' },
};

const SCOPE_LABELS: Record<string, string> = {
  today: 'DZIŚ',
  weekend: 'WEEKEND',
  all_time: 'WSZECHCZASÓW',
};

function ScopeImpactChip({ impact }: { impact: ScopeImpact }) {
  const label = SCOPE_LABELS[impact.scope] ?? impact.scope;
  const hasPos = impact.position !== null && impact.position > 0;

  return (
    <View style={[
      chipStyles.chip,
      hasPos && chipStyles.chipActive,
    ]}>
      <Text style={chipStyles.chipLabel}>{label}</Text>
      {hasPos ? (
        <>
          <Text style={[
            chipStyles.chipPos,
            impact.position! <= 3 && { color: colors.gold },
            impact.position! <= 10 && impact.position! > 3 && { color: colors.accent },
          ]}>
            #{impact.position}
          </Text>
          <Text style={chipStyles.chipTotal}>/ {impact.totalRiders}</Text>
        </>
      ) : (
        <Text style={chipStyles.chipOff}>POZA TABLICĄ</Text>
      )}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    borderColor: colors.accent + '40',
  },
  chipLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 2,
    fontSize: 8,
    marginBottom: spacing.xs,
  },
  chipPos: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 20,
    color: colors.textPrimary,
  },
  chipTotal: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    marginTop: 2,
  },
  chipOff: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    marginTop: spacing.xs,
  },
});

export default function ResultScreen() {
  const { runSessionId } = useLocalSearchParams<{ runSessionId: string }>();
  const router = useRouter();
  const { profile: authProfile } = useAuthContext();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const [retrying, setRetrying] = useState(false);

  // ── Read from store + subscribe for live updates ──
  const run = runSessionId ? getFinalizedRun(runSessionId) : undefined;

  // ── Scoped board impact — fetched after save completes ──
  const { impact: scopedImpact } = useResultImpact(
    authProfile?.id,
    run?.trailId,
    run?.saveStatus === 'saved',
  );

  useEffect(() => {
    if (!runSessionId) return;
    const unsub = subscribeFinalizedRun(() => forceUpdate());
    return unsub;
  }, [runSessionId]);

  // ── Entrance animation + haptics (once) ──
  const [hapticFired, setHapticFired] = useState(false);
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  // Fire haptics when save status resolves
  useEffect(() => {
    if (hapticFired || !run) return;
    if (run.saveStatus === 'saved') {
      const isPb = run.backendResult?.isPb;
      if (isPb) {
        tapHeavy();
        setTimeout(() => notifySuccess(), 200);
        setTimeout(() => notifySuccess(), 500);
      } else {
        notifySuccess();
      }
      setHapticFired(true);
    } else if (run.saveStatus === 'failed' || run.saveStatus === 'offline') {
      notifyWarning();
      setHapticFired(true);
    }
  }, [run?.saveStatus, hapticFired]);

  // ── Retry save ──
  const handleRetrySave = async () => {
    if (!run || !authProfile?.id || retrying) return;
    if (run.saveStatus !== 'failed') return;

    setRetrying(true);
    logDebugEvent('save', 'retry_start', 'start', { runSessionId: run.sessionId, trailId: run.trailId });
    updateFinalizedRun(run.sessionId, { saveStatus: 'saving' as any });
    forceUpdate();

    try {
      const xpAwarded = run.verification?.isLeaderboardEligible ? XP_TABLE.validRun : 0;
      // Build trace from stored snapshot for retry
      const snap = run.traceSnapshot;
      if (!snap) {
        logDebugEvent('save', 'retry_no_trace', 'fail', { runSessionId: run.sessionId });
        updateFinalizedRun(run.sessionId, { saveStatus: 'failed' });
        notifyWarning();
        setRetrying(false);
        return;
      }

      const traceForRetry = {
        points: snap.sampledPoints.map((p: any) => ({
          latitude: p.lat, longitude: p.lng, altitude: p.alt, timestamp: p.ts,
          speed: null, accuracy: null,
        })),
        startedAt: snap.startedAt,
        finishedAt: snap.finishedAt,
        durationMs: snap.durationMs,
        mode: snap.mode,
      };

      const result = await submitRunToBackend({
        userId: authProfile.id,
        spotId: 'slotwiny-arena',
        trailId: run.trailId,
        mode: run.mode,
        startedAt: run.startedAt,
        finishedAt: run.startedAt + run.durationMs,
        durationMs: run.durationMs,
        verification: run.verification!,
        trace: traceForRetry as any,
        xpAwarded,
      });

      if (result) {
        logDebugEvent('save', 'retry_ok', 'ok', { runSessionId: run.sessionId });
        updateFinalizedRun(run.sessionId, { saveStatus: 'saved', backendResult: result });
        triggerRefresh();
        notifySuccess();
      } else {
        logDebugEvent('save', 'retry_null', 'fail', { runSessionId: run.sessionId });
        updateFinalizedRun(run.sessionId, { saveStatus: 'failed' });
        notifyWarning();
      }
    } catch (e) {
      logDebugEvent('save', 'retry_error', 'fail', { runSessionId: run.sessionId, payload: { error: String(e) } });
      updateFinalizedRun(run.sessionId, { saveStatus: 'failed' });
      notifyWarning();
    }
    setRetrying(false);
    forceUpdate();
  };

  // ── Fallback if no run in store ──
  if (!run) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Brak danych zjazdu</Text>
          <Pressable style={styles.fallbackBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.fallbackBtnText}>STRONA GŁÓWNA</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Derive display state from store ──
  const trail = getTrailById(run.trailId);
  const trailName = run.trailName || trail?.officialName || 'Unknown Trail';
  const v = run.verification;
  const vStatus = v?.status ?? 'pending';
  const vd = V_DISPLAY[vStatus] ?? V_DISPLAY.pending;
  const issues = v?.issues ?? [];
  const isVerified = vStatus === 'verified';
  const isRanked = run.mode === 'ranked';
  const isPb = run.backendResult?.isPb ?? false;
  const rankPosition = run.backendResult?.leaderboardResult?.position ?? 0;
  const rankDelta = run.backendResult?.leaderboardResult?.delta ?? 0;
  const xpAwarded = run.backendResult?.run?.xp_awarded ?? (run.saveStatus === 'saved' ? XP_TABLE.validRun : 0);
  const showRank = isRanked && isVerified && rankPosition > 0;
  const isSaving = run.saveStatus === 'saving' || run.saveStatus === 'pending';

  // Tier context for rank
  const tierLabel = rankPosition <= 3 && rankPosition > 0 ? 'PODIUM'
    : rankPosition <= 10 && rankPosition > 0 ? 'TOP 10'
    : null;
  const placesToNextTier = rankPosition === 0 ? 0
    : rankPosition <= 3 ? 0
    : rankPosition <= 10 ? rankPosition - 3
    : rankPosition - 10;
  const movedIntoTier = rankDelta > 0 && (
    (rankPosition <= 3 && rankPosition + rankDelta > 3) ||
    (rankPosition <= 10 && rankPosition + rankDelta > 10)
  );

  return (
    <SafeAreaView style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        style={{ opacity: fadeAnim }}
      >
        {/* ── Trail + mode header ── */}
        <View style={styles.header}>
          <Text style={styles.trailLabel}>{trailName.toUpperCase()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: vd.bg }]}>
            <Text style={[styles.statusIcon, { color: vd.color }]}>{vd.icon}</Text>
            <Text style={[styles.statusText, { color: vd.color }]}>{vd.label}</Text>
          </View>
        </View>

        {/* ── THE TIME ── */}
        <View style={styles.timeContainer}>
          <Text style={[styles.timeHero, isPb && { color: colors.accent }]}>
            {formatTime(run.durationMs)}
          </Text>
        </View>

        {/* ── PB ── */}
        {isPb && (
          <View style={styles.pbCard}>
            <Text style={styles.pbLabel}>NOWY REKORD</Text>
          </View>
        )}

        {/* ── Rank position with tier context ── */}
        {showRank && (
          <View style={[
            styles.rankCard,
            movedIntoTier && { borderColor: colors.gold },
          ]}>
            <View style={styles.rankRow}>
              <Text style={[
                styles.rankPosition,
                rankPosition <= 3 && { color: colors.gold },
              ]}>
                #{rankPosition}
              </Text>
              {rankDelta > 0 && (
                <View style={styles.rankDeltaBadge}>
                  <Text style={styles.rankDeltaText}>↑{rankDelta}</Text>
                </View>
              )}
              {rankDelta === 0 && rankPosition > 0 && (
                <Text style={styles.deltaFlat}>NOWY WPIS</Text>
              )}
            </View>

            {/* Tier label */}
            {tierLabel && (
              <Text style={[
                styles.tierLabel,
                tierLabel === 'PODIUM' && { color: colors.gold },
                tierLabel === 'TOP 10' && { color: colors.accent },
              ]}>
                {movedIntoTier ? `WEJŚCIE DO ${tierLabel}` : tierLabel}
              </Text>
            )}

            {/* Ambition cue — what's next */}
            {!tierLabel && placesToNextTier > 0 && placesToNextTier <= 7 && (
              <Text style={styles.ambitionText}>
                {placesToNextTier === 1 ? '1 pozycja' : `${placesToNextTier} pozycji`} do TOP 10
              </Text>
            )}

            <Text style={styles.rankLabel}>TABLICA WYNIKÓW</Text>
          </View>
        )}

        {/* ── XP ── */}
        {xpAwarded > 0 && (
          <View style={styles.xpRow}>
            <Text style={styles.xpValue}>+{xpAwarded} XP</Text>
          </View>
        )}

        {/* ── Save status ── */}
        <View style={styles.saveRow}>
          {isSaving && (
            <View style={styles.savingBadge}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.savingText}>ZAPISUJĘ DO LIGI...</Text>
            </View>
          )}
          {run.saveStatus === 'saved' && (
            <View style={styles.saveOkBadge}>
              <Text style={styles.saveOkText}>✓ ZAPISANO W LIDZE</Text>
            </View>
          )}
          {run.saveStatus === 'failed' && (
            <View style={styles.saveFailBadge}>
              <Text style={styles.saveFailText}>ZAPIS NIE POWIÓDŁ SIĘ</Text>
            </View>
          )}
          {run.saveStatus === 'offline' && run.mode === 'practice' && (
            <View style={styles.savePracticeBadge}>
              <Text style={styles.savePracticeText}>TRENING — POZA TABLICĄ</Text>
            </View>
          )}
          {run.saveStatus === 'offline' && run.mode !== 'practice' && (
            <View style={styles.saveFailBadge}>
              <Text style={styles.saveFailText}>OFFLINE — NIE ZAPISANO</Text>
            </View>
          )}
        </View>

        {/* ── Sync failure explanation + retry ── */}
        {run.saveStatus === 'failed' && isRanked && isVerified && (
          <View style={styles.syncFailCard}>
            <Text style={styles.syncFailTitle}>TWÓJ ZJAZD BYŁ PRAWIDŁOWY</Text>
            <Text style={styles.syncFailBody}>
              Zjazd przeszedł weryfikację, ale nie udało się go zapisać. To może być problem z połączeniem.
            </Text>
            <Pressable
              style={[styles.retryBtn, retrying && { opacity: 0.5 }]}
              onPress={handleRetrySave}
              disabled={retrying}
            >
              <Text style={styles.retryBtnText}>
                {retrying ? 'ZAPISUJĘ...' : 'SPRÓBUJ ZAPISAĆ PONOWNIE'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── Verification issues ── */}
        {issues.length > 0 && (
          <View style={styles.issuesCard}>
            {issues.map((issue, i) => (
              <Text key={i} style={styles.issueText}>• {issue}</Text>
            ))}
          </View>
        )}

        {/* ═══ LEAGUE IMPACT — scoped board consequence ═══ */}
        {scopedImpact.length > 0 && run.saveStatus === 'saved' && (
          <View style={styles.impactSection}>
            <Text style={styles.impactTitle}>WPŁYW NA LIGĘ</Text>
            <Text style={styles.impactTrail}>{trailName}</Text>
            <View style={styles.impactGrid}>
              {scopedImpact.map((s) => (
                <ScopeImpactChip key={s.scope} impact={s} />
              ))}
            </View>
          </View>
        )}

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── CTAs — Run Again is primary, Leaderboard gains context ── */}
        <Pressable style={styles.runAgainBtn} onPress={() => {
          tapLight();
          router.replace({ pathname: '/run/active', params: { trailId: run.trailId, trailName } });
        }}>
          <Text style={styles.runAgainText}>JEDŹ PONOWNIE</Text>
        </Pressable>

        <View style={styles.secondaryCtaRow}>
          <Pressable style={[
            styles.leaderboardBtn,
            showRank && { borderColor: colors.accent },
          ]} onPress={() => {
            tapLight();
            router.replace({
              pathname: '/(tabs)/leaderboard',
              params: { trailId: run.trailId, scope: 'all_time' },
            });
          }}>
            <Text style={[
              styles.leaderboardBtnText,
              showRank && { color: colors.accent },
            ]}>
              {showRank ? `TABLICA · #${rankPosition}` : 'TABLICA'}
            </Text>
          </Pressable>

          <Pressable style={styles.trailBtn} onPress={() => {
            tapLight();
            router.replace(`/trail/${run.trailId}`);
          }}>
            <Text style={styles.trailBtnText}>TRASA</Text>
          </Pressable>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.xxl, paddingBottom: spacing.huge },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  fallbackText: { ...typography.body, color: colors.textSecondary },
  fallbackBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl },
  fallbackBtnText: { ...typography.cta, color: colors.bg, letterSpacing: 2 },

  header: { alignItems: 'center', marginBottom: spacing.lg, gap: spacing.sm },
  trailLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, fontSize: 11 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xxs },
  statusIcon: { fontFamily: 'Inter_700Bold', fontSize: 12 },
  statusText: { ...typography.labelSmall, letterSpacing: 2, fontSize: 10 },

  timeContainer: { alignItems: 'center', paddingVertical: spacing.xl },
  timeHero: { fontFamily: 'Orbitron_700Bold', fontSize: 64, color: colors.textPrimary, letterSpacing: 4 },

  pbCard: { alignItems: 'center', backgroundColor: colors.accentDim, borderRadius: radii.md, paddingVertical: spacing.md, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.accent },
  pbLabel: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: colors.accent, letterSpacing: 4 },

  rankCard: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rankPosition: { fontFamily: 'Orbitron_700Bold', fontSize: 36, color: colors.textPrimary },
  rankDeltaBadge: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  rankDeltaText: { ...typography.label, color: colors.accent, fontSize: 16 },
  deltaFlat: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2 },
  rankLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, marginTop: spacing.sm },

  tierLabel: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    color: colors.textSecondary,
    letterSpacing: 4,
    marginTop: spacing.sm,
  },
  ambitionText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginTop: spacing.sm,
  },

  xpRow: { alignItems: 'center', marginBottom: spacing.md },
  xpValue: { fontFamily: 'Orbitron_700Bold', fontSize: 18, color: colors.gold, letterSpacing: 2 },

  saveRow: { alignItems: 'center', marginBottom: spacing.lg },
  savingBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgCard, borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  savingText: { ...typography.labelSmall, color: colors.accent, letterSpacing: 1 },
  saveOkBadge: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  saveOkText: { ...typography.labelSmall, color: colors.accent, letterSpacing: 2 },
  savePracticeBadge: { backgroundColor: 'rgba(0,122,255,0.1)', borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  savePracticeText: { ...typography.labelSmall, color: colors.blue, letterSpacing: 1 },
  saveFailBadge: { backgroundColor: 'rgba(255,149,0,0.1)', borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  saveFailText: { ...typography.labelSmall, color: colors.orange, letterSpacing: 1 },

  syncFailCard: { backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.orange },
  syncFailTitle: { ...typography.labelSmall, color: colors.orange, letterSpacing: 2, marginBottom: spacing.sm },
  syncFailBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },
  retryBtn: { borderWidth: 1, borderColor: colors.orange, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center' },
  retryBtnText: { ...typography.label, color: colors.orange, letterSpacing: 2, fontSize: 12 },

  issuesCard: { backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  issueText: { ...typography.bodySmall, color: colors.textTertiary, lineHeight: 20 },

  impactSection: { marginBottom: spacing.lg },
  impactTitle: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, fontSize: 9, textAlign: 'center', marginBottom: spacing.xxs },
  impactTrail: { ...typography.labelSmall, color: colors.textSecondary, letterSpacing: 2, fontSize: 10, textAlign: 'center', marginBottom: spacing.md },
  impactGrid: { flexDirection: 'row', gap: spacing.sm },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },

  runAgainBtn: { backgroundColor: colors.accent, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  runAgainText: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: colors.bg, letterSpacing: 4 },
  secondaryCtaRow: { flexDirection: 'row', gap: spacing.sm },
  leaderboardBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingVertical: spacing.md, alignItems: 'center' },
  leaderboardBtnText: { ...typography.label, color: colors.textSecondary, letterSpacing: 3 },
  trailBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingVertical: spacing.md, alignItems: 'center' },
  trailBtnText: { ...typography.label, color: colors.textSecondary, letterSpacing: 3 },
});
