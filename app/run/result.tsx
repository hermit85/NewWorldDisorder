// ═══════════════════════════════════════════════════════════
// Result Screen — post-run experience
// Source of truth: runStore (not route params)
// Subscribes to store updates so backend save resolves live
//
// PRODUCT TONE: gravity racing game finish screen
// Not a fitness tracker. Not a GPS debug panel.
// Clean, premium, emotional — official race result.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useReducer } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailById } from '@/data/seed/slotwinyOfficial';
import { XP_TABLE } from '@/systems/xp';
import { formatTime } from '@/content/copy';
import { tapLight, tapMedium, tapHeavy, notifySuccess, notifyWarning, selectionTick } from '@/systems/haptics';
import { getFinalizedRun, subscribeFinalizedRun, updateFinalizedRun } from '@/systems/runStore';
import { useAuthContext } from '@/hooks/AuthContext';
import { useResultImpact, ScopeImpact, submitRunToBackend } from '@/hooks/useBackend';
import { logDebugEvent } from '@/systems/debugEvents';
import { triggerRefresh } from '@/hooks/useRefresh';

// ═══════════════════════════════════════════════════════════
// PRODUCT COPY — human, premium, gravity racing tone
// No tech jargon user-facing. No "GPS error". No "invalid".
// ═══════════════════════════════════════════════════════════

/** Maps verification status to user-facing presentation */
const STATUS_DISPLAY: Record<string, {
  eyebrow: string;
  label: string;
  color: string;
  bg: string;
  icon: string;
  description: string;
}> = {
  verified: {
    eyebrow: 'OFICJALNY',
    label: 'ZALICZONY',
    color: colors.accent,
    bg: colors.accentDim,
    icon: '✓',
    description: 'Zjazd zweryfikowany i zapisany w lidze.',
  },
  practice_only: {
    eyebrow: 'TRENING',
    label: 'ZAPISANY',
    color: colors.blue,
    bg: 'rgba(0,122,255,0.15)',
    icon: '○',
    description: 'Trening zapisany. Nie wpływa na ranking.',
  },
  weak_signal: {
    eyebrow: 'OGRANICZONE ZAUFANIE',
    label: 'ZAPISANY',
    color: colors.orange,
    bg: 'rgba(255,149,0,0.12)',
    icon: '!',
    description: 'Sygnał GPS był niestabilny. Zjazd zapisany, ale ranking ograniczony.',
  },
  missing_checkpoint: {
    eyebrow: 'NIEKOMPLETNY',
    label: 'ZAPISANY',
    color: colors.orange,
    bg: 'rgba(255,149,0,0.12)',
    icon: '!',
    description: 'Nie wszystkie punkty kontrolne zostały zaliczone.',
  },
  shortcut_detected: {
    eyebrow: 'POZA TRASĄ',
    label: 'NIE ZALICZONY',
    color: colors.red,
    bg: 'rgba(255,59,48,0.08)',
    icon: '✕',
    description: 'Wykryto odchylenie od oficjalnej trasy.',
  },
  outside_start_gate: {
    eyebrow: 'BEZ BRAMKI',
    label: 'NIE ZALICZONY',
    color: colors.red,
    bg: 'rgba(255,59,48,0.08)',
    icon: '✕',
    description: 'Bramka startowa nie została wykryta.',
  },
  outside_finish_gate: {
    eyebrow: 'BEZ METY',
    label: 'NIE ZALICZONY',
    color: colors.red,
    bg: 'rgba(255,59,48,0.08)',
    icon: '✕',
    description: 'Meta nie została wykryta. Spróbuj ponownie.',
  },
  invalid_route: {
    eyebrow: 'POZA TRASĄ',
    label: 'NIE ZALICZONY',
    color: colors.red,
    bg: 'rgba(255,59,48,0.08)',
    icon: '✕',
    description: 'Trasa przejazdu nie pasuje do oficjalnego przebiegu.',
  },
  pending: {
    eyebrow: 'WERYFIKACJA',
    label: 'SPRAWDZAM',
    color: colors.gold,
    bg: 'rgba(255,204,0,0.08)',
    icon: '…',
    description: 'Trwa weryfikacja zjazdu.',
  },
};

const SCOPE_LABELS: Record<string, string> = {
  today: 'DZIŚ',
  weekend: 'WEEKEND',
  all_time: 'ALL TIME',
};

// ═══════════════════════════════════════════════════════════

function ScopeImpactChip({ impact }: { impact: ScopeImpact }) {
  const label = SCOPE_LABELS[impact.scope] ?? impact.scope;
  const hasPos = impact.position !== null && impact.position > 0;

  return (
    <View style={[chipStyles.chip, hasPos && chipStyles.chipActive]}>
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
        <Text style={chipStyles.chipOff}>—</Text>
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
  chipActive: { borderColor: colors.accent + '30' },
  chipLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, fontSize: 8, marginBottom: spacing.xs },
  chipPos: { fontFamily: 'Orbitron_700Bold', fontSize: 20, color: colors.textPrimary },
  chipTotal: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 9, marginTop: 2 },
  chipOff: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 14, marginTop: spacing.xs },
});

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════

export default function ResultScreen() {
  const { runSessionId } = useLocalSearchParams<{ runSessionId: string }>();
  const router = useRouter();
  const { profile: authProfile } = useAuthContext();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [timeScaleAnim] = useState(new Animated.Value(0.8));
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const [retrying, setRetrying] = useState(false);

  const run = runSessionId ? getFinalizedRun(runSessionId) : undefined;

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

  // ── Entrance animation — time punches in ──
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(timeScaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // ── Haptics on save resolution ──
  const [hapticFired, setHapticFired] = useState(false);
  useEffect(() => {
    if (hapticFired || !run) return;
    if (run.saveStatus === 'saved') {
      const isPb = run.backendResult?.isPb;
      if (isPb) {
        tapHeavy();
        setTimeout(() => notifySuccess(), 150);
        setTimeout(() => tapMedium(), 400);
        setTimeout(() => notifySuccess(), 600);
      } else {
        tapMedium();
        setTimeout(() => notifySuccess(), 200);
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
    selectionTick();
    logDebugEvent('save', 'retry_start', 'start', { runSessionId: run.sessionId, trailId: run.trailId });
    updateFinalizedRun(run.sessionId, { saveStatus: 'saving' as any });
    forceUpdate();

    try {
      const xpAwarded = run.verification?.isLeaderboardEligible ? XP_TABLE.validRun : 0;
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

  // ── Fallback ──
  if (!run) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Brak danych zjazdu</Text>
          <Pressable style={styles.fallbackBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.fallbackBtnText}>WRÓĆ</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // DERIVE DISPLAY STATE
  // ═══════════════════════════════════════════════════════════

  const trail = getTrailById(run.trailId);
  const trailName = run.trailName || trail?.officialName || 'Unknown Trail';
  const v = run.verification;
  const vStatus = v?.status ?? 'pending';
  const sd = STATUS_DISPLAY[vStatus] ?? STATUS_DISPLAY.pending;
  const isVerified = vStatus === 'verified';
  const isRanked = run.mode === 'ranked';
  const isPractice = run.mode === 'practice';
  const isPb = run.backendResult?.isPb ?? false;
  const rankPosition = run.backendResult?.leaderboardResult?.position ?? 0;
  const rankDelta = run.backendResult?.leaderboardResult?.delta ?? 0;
  const xpAwarded = run.backendResult?.run?.xp_awarded ?? (run.saveStatus === 'saved' ? XP_TABLE.validRun : 0);
  const showRank = isRanked && isVerified && rankPosition > 0;
  const isSaving = run.saveStatus === 'saving' || run.saveStatus === 'pending';
  const isSaved = run.saveStatus === 'saved';
  const isFailed = run.saveStatus === 'failed';
  const isQueued = run.saveStatus === 'queued';

  // Quality-based status for saved ranked runs
  const isOfficialRankedResult = showRank && isSaved;
  const isSavedButNotRanked = isSaved && !showRank && isRanked;

  // Tier context
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
        {/* ═══ HEADER — trail + status eyebrow ═══ */}
        <View style={styles.header}>
          <Text style={styles.trailLabel}>{trailName.toUpperCase()}</Text>
          <View style={[styles.statusBadge, { backgroundColor: sd.bg }]}>
            <Text style={[styles.statusIcon, { color: sd.color }]}>{sd.icon}</Text>
            <Text style={[styles.statusText, { color: sd.color }]}>{sd.eyebrow}</Text>
          </View>
        </View>

        {/* ═══ THE TIME — hero element ═══ */}
        <Animated.View style={[styles.timeContainer, { transform: [{ scale: timeScaleAnim }] }]}>
          <Text style={[
            styles.timeHero,
            isPb && { color: colors.accent },
            isOfficialRankedResult && !isPb && { color: colors.textPrimary },
            !isVerified && !isPractice && { color: colors.textSecondary },
          ]}>
            {formatTime(run.durationMs)}
          </Text>
        </Animated.View>

        {/* ═══ PB CELEBRATION ═══ */}
        {isPb && (
          <View style={styles.pbCard}>
            <Text style={styles.pbIcon}>▲</Text>
            <Text style={styles.pbLabel}>PERSONAL BEST</Text>
          </View>
        )}

        {/* ═══ RANK CARD — only for official ranked results ═══ */}
        {showRank && (
          <View style={[
            styles.rankCard,
            movedIntoTier && { borderColor: colors.gold + '60' },
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
                <Text style={styles.deltaNew}>NOWY</Text>
              )}
            </View>

            {tierLabel && (
              <Text style={[
                styles.tierLabel,
                tierLabel === 'PODIUM' && { color: colors.gold },
                tierLabel === 'TOP 10' && { color: colors.accent },
              ]}>
                {movedIntoTier ? `WEJŚCIE DO ${tierLabel}` : tierLabel}
              </Text>
            )}

            {!tierLabel && placesToNextTier > 0 && placesToNextTier <= 7 && (
              <Text style={styles.ambitionText}>
                {placesToNextTier === 1 ? '1 pozycja' : `${placesToNextTier} pozycji`} do TOP 10
              </Text>
            )}

            <Text style={styles.rankSublabel}>OFICJALNY RANKING</Text>
          </View>
        )}

        {/* ═══ XP ═══ */}
        {xpAwarded > 0 && (
          <View style={styles.xpRow}>
            <Text style={styles.xpValue}>+{xpAwarded} XP</Text>
          </View>
        )}

        {/* ═══ SAVE STATUS — league sync ═══ */}
        <View style={styles.saveRow}>
          {isSaving && (
            <View style={styles.savingBadge}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.savingText}>SYNCHRONIZUJĘ Z LIGĄ...</Text>
            </View>
          )}
          {isSaved && isVerified && (
            <View style={styles.saveOfficialBadge}>
              <Text style={styles.saveOfficialText}>✓ OFICJALNY WYNIK LIGI</Text>
            </View>
          )}
          {isSaved && !isVerified && isRanked && (
            <View style={styles.saveSavedBadge}>
              <Text style={styles.saveSavedText}>ZAPISANY · POZA OFICJALNYM RANKINGIEM</Text>
            </View>
          )}
          {isPractice && (
            <View style={styles.savePracticeBadge}>
              <Text style={styles.savePracticeText}>TRENING · POZA RANKINGIEM</Text>
            </View>
          )}
          {isFailed && (
            <View style={styles.saveFailBadge}>
              <Text style={styles.saveFailText}>NIE UDAŁO SIĘ ZAPISAĆ</Text>
            </View>
          )}
          {isQueued && (
            <View style={styles.saveQueuedBadge}>
              <Text style={styles.saveQueuedText}>CZEKA NA ZAPIS · PONOWI AUTOMATYCZNIE</Text>
            </View>
          )}
          {run.saveStatus === 'offline' && !isPractice && (
            <View style={styles.saveFailBadge}>
              <Text style={styles.saveFailText}>BRAK POŁĄCZENIA</Text>
            </View>
          )}
        </View>

        {/* ═══ STATUS CONTEXT — soft human explanation ═══ */}
        {!isVerified && !isPractice && vStatus !== 'pending' && (
          <View style={styles.statusContextCard}>
            <Text style={[styles.statusContextLabel, { color: sd.color }]}>{sd.label}</Text>
            <Text style={styles.statusContextBody}>{sd.description}</Text>
          </View>
        )}

        {/* ═══ RETRY CARD — verified but sync failed/queued ═══ */}
        {(isFailed || isQueued) && isRanked && isVerified && (
          <View style={styles.retryCard}>
            <Text style={styles.retryTitle}>ZJAZD BYŁ CZYSTY</Text>
            <Text style={styles.retryBody}>
              Weryfikacja przeszła, ale zapis do ligi nie powiódł się. Spróbuj ponownie.
            </Text>
            <Pressable
              style={[styles.retryBtn, retrying && { opacity: 0.5 }]}
              onPress={handleRetrySave}
              disabled={retrying}
            >
              <Text style={styles.retryBtnText}>
                {retrying ? 'ZAPISUJĘ...' : 'PONÓW ZAPIS'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ═══ LEAGUE IMPACT — scoped positions ═══ */}
        {scopedImpact.length > 0 && isSaved && (
          <View style={styles.impactSection}>
            <Text style={styles.impactTitle}>POZYCJA W LIDZE</Text>
            <View style={styles.impactGrid}>
              {scopedImpact.map((s) => (
                <ScopeImpactChip key={s.scope} impact={s} />
              ))}
            </View>
          </View>
        )}

        {/* ═══ DIVIDER ═══ */}
        <View style={styles.divider} />

        {/* ═══ CTAs ═══ */}
        <Pressable
          style={({ pressed }) => [
            styles.runAgainBtn,
            pressed && styles.runAgainBtnPressed,
          ]}
          onPress={() => {
            tapMedium();
            router.replace({ pathname: '/run/active', params: { trailId: run.trailId, trailName } });
          }}
        >
          <Text style={styles.runAgainText}>JEDŹ PONOWNIE</Text>
        </Pressable>

        <View style={styles.secondaryCtaRow}>
          <Pressable
            style={[
              styles.secondaryBtn,
              showRank && { borderColor: colors.accent + '60' },
            ]}
            onPress={() => {
              tapLight();
              router.replace({
                pathname: '/(tabs)/leaderboard',
                params: { trailId: run.trailId, scope: 'all_time' },
              });
            }}
          >
            <Text style={[
              styles.secondaryBtnText,
              showRank && { color: colors.accent },
            ]}>
              {showRank ? `RANKING · #${rankPosition}` : 'RANKING'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => {
              tapLight();
              router.replace(`/trail/${run.trailId}`);
            }}
          >
            <Text style={styles.secondaryBtnText}>TRASA</Text>
          </Pressable>
        </View>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingTop: spacing.xxxl, paddingBottom: spacing.huge },
  fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  fallbackText: { ...typography.body, color: colors.textSecondary },
  fallbackBtn: { backgroundColor: colors.bgElevated, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderWidth: 1, borderColor: colors.border },
  fallbackBtnText: { ...typography.label, color: colors.textSecondary, letterSpacing: 2 },

  // Header
  header: { alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  trailLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, fontSize: 11 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xxs },
  statusIcon: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  statusText: { ...typography.labelSmall, letterSpacing: 3, fontSize: 9 },

  // Time — hero
  timeContainer: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.sm },
  timeHero: { fontFamily: 'Orbitron_700Bold', fontSize: 64, color: colors.textPrimary, letterSpacing: 3 },

  // PB celebration
  pbCard: {
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    gap: spacing.xxs,
  },
  pbIcon: { fontFamily: 'Orbitron_700Bold', fontSize: 12, color: colors.accent },
  pbLabel: { fontFamily: 'Orbitron_700Bold', fontSize: 14, color: colors.accent, letterSpacing: 5 },

  // Rank card
  rankCard: {
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rankPosition: { fontFamily: 'Orbitron_700Bold', fontSize: 40, color: colors.textPrimary },
  rankDeltaBadge: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  rankDeltaText: { fontFamily: 'Orbitron_700Bold', color: colors.accent, fontSize: 16 },
  deltaNew: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3 },
  rankSublabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, marginTop: spacing.md, fontSize: 8 },
  tierLabel: { fontFamily: 'Orbitron_700Bold', fontSize: 11, color: colors.textSecondary, letterSpacing: 4, marginTop: spacing.sm },
  ambitionText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 1, marginTop: spacing.sm },

  // XP
  xpRow: { alignItems: 'center', marginBottom: spacing.md },
  xpValue: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: colors.gold, letterSpacing: 2 },

  // Save status
  saveRow: { alignItems: 'center', marginBottom: spacing.lg },
  savingBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgCard, borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  savingText: { ...typography.labelSmall, color: colors.accent, letterSpacing: 1 },
  saveOfficialBadge: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  saveOfficialText: { ...typography.labelSmall, color: colors.accent, letterSpacing: 2, fontSize: 10 },
  saveSavedBadge: { backgroundColor: colors.bgCard, borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border },
  saveSavedText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 1, fontSize: 9 },
  savePracticeBadge: { backgroundColor: 'rgba(0,122,255,0.08)', borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  savePracticeText: { ...typography.labelSmall, color: colors.blue, letterSpacing: 1, fontSize: 10 },
  saveFailBadge: { backgroundColor: 'rgba(255,149,0,0.08)', borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  saveFailText: { ...typography.labelSmall, color: colors.orange, letterSpacing: 1, fontSize: 10 },
  saveQueuedBadge: { backgroundColor: 'rgba(255,204,0,0.08)', borderRadius: radii.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  saveQueuedText: { ...typography.labelSmall, color: colors.gold, letterSpacing: 1, fontSize: 9 },

  // Status context card (non-verified explanation)
  statusContextCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusContextLabel: { ...typography.labelSmall, letterSpacing: 3, fontSize: 10 },
  statusContextBody: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', lineHeight: 20 },

  // Retry card
  retryCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.orange + '30',
    alignItems: 'center',
  },
  retryTitle: { ...typography.labelSmall, color: colors.orange, letterSpacing: 3, marginBottom: spacing.sm, fontSize: 10 },
  retryBody: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', lineHeight: 20, marginBottom: spacing.md },
  retryBtn: { borderWidth: 1, borderColor: colors.orange + '60', borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignItems: 'center' },
  retryBtnText: { ...typography.label, color: colors.orange, letterSpacing: 2, fontSize: 11 },

  // League impact
  impactSection: { marginBottom: spacing.lg },
  impactTitle: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, fontSize: 8, textAlign: 'center', marginBottom: spacing.md },
  impactGrid: { flexDirection: 'row', gap: spacing.sm },

  // Divider
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xl },

  // CTAs
  runAgainBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  runAgainBtnPressed: {
    backgroundColor: colors.accentGlow,
    transform: [{ scale: 0.98 }],
  },
  runAgainText: { fontFamily: 'Orbitron_700Bold', fontSize: 15, color: colors.bg, letterSpacing: 5 },
  secondaryCtaRow: { flexDirection: 'row', gap: spacing.sm },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingVertical: spacing.md, alignItems: 'center' },
  secondaryBtnText: { ...typography.label, color: colors.textSecondary, letterSpacing: 3 },
});
