// ═══════════════════════════════════════════════════════════
// Result Screen — post-run experience
// Source of truth: runStore (not route params)
// Subscribes to store updates so backend save resolves live
//
// PRODUCT TONE: gravity racing game finish screen
// Not a fitness tracker. Not a GPS debug panel.
// Clean, premium, emotional — official race result.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useReducer, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, ActivityIndicator, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { hudColors, hudTypography, hudShadows } from '@/theme/gameHud';
import { useTrail, useSpot, useRun } from '@/hooks/useBackend';
import { calculateRunXp, getLevel } from '@/systems/xp';
import { formatTime } from '@/content/copy';
import { tapLight, tapMedium, tapHeavy, notifySuccess, notifyWarning, selectionTick } from '@/systems/haptics';
import { getFinalizedRun, subscribeFinalizedRun } from '@/systems/runStore';
import { retryRunSubmit } from '@/systems/retrySubmit';
import { useAuthContext } from '@/hooks/AuthContext';
import { useResultImpact, ScopeImpact, useProfile } from '@/hooks/useBackend';
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
    description: 'Słaby GPS. Wynik zapisany, ale poza oficjalnym rankingiem.',
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
    description: 'Zjechałeś poza oficjalną trasę. Spróbuj ponownie.',
  },
  outside_start_gate: {
    eyebrow: 'BEZ BRAMKI',
    label: 'NIE ZALICZONY',
    color: colors.red,
    bg: 'rgba(255,59,48,0.08)',
    icon: '✕',
    description: 'Nie wykryto przejazdu przez bramkę startową.',
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
    description: 'Przejazd nie pokrywa się z oficjalną trasą.',
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
  all_time: 'SEZON',
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

// ═══════════════════════════════════════════════════════════
// Route entry — branches on isPioneer.
// Pioneer finalize (Sprint 3 Chunk 5) arrives with runId+isPioneer=true
// and no runSessionId — that path never went through runStore, so the
// standard body below has nothing to read. A route-level branch avoids
// rules-of-hooks violations from an in-body early return.
// ═══════════════════════════════════════════════════════════

export default function ResultScreen() {
  const params = useLocalSearchParams<{
    runSessionId?: string;
    runId?: string;
    isPioneer?: string;
  }>();
  if (params.isPioneer === 'true' && params.runId) {
    return <PioneerResultScreen runId={params.runId} />;
  }
  return <StandardResultScreen />;
}

function StandardResultScreen() {
  const { runSessionId } = useLocalSearchParams<{ runSessionId: string }>();
  const router = useRouter();
  const { profile: authProfile } = useAuthContext();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [timeScaleAnim] = useState(new Animated.Value(0.8));
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  const [retrying, setRetrying] = useState(false);

  const run = runSessionId ? getFinalizedRun(runSessionId) : undefined;

  // Checkpoint A: prefer runStore.trailName (K4), fall back to DB fetch
  // when it is missing (cold start after app restart). Hook must be
  // called unconditionally so we pass null when trailName already exists.
  const { trail: fetchedTrail } = useTrail(
    run?.trailId && !run?.trailName ? run.trailId : null,
  );

  const { profile: currentProfile } = useProfile(authProfile?.id);

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
      // Extra haptic for level up
      if (isLevelUp) {
        setTimeout(() => tapHeavy(), 800);
      }
      setHapticFired(true);
    } else if (run.saveStatus === 'failed' || run.saveStatus === 'offline') {
      notifyWarning();
      setHapticFired(true);
    }
  }, [run?.saveStatus, hapticFired]);

  // ── Retry save — uses canonical path (same as saveQueue) ──
  const handleRetrySave = async () => {
    if (!run || retrying) return;
    if (run.saveStatus !== 'failed' && run.saveStatus !== 'queued' && run.saveStatus !== 'offline') return;
    if (!run.userId) return;

    setRetrying(true);
    selectionTick();

    const { success } = await retryRunSubmit(run);

    if (success) {
      notifySuccess();
    } else {
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

  const trailName = run.trailName || fetchedTrail?.name || 'Unknown Trail';
  const v = run.verification;
  const vStatus = v?.status ?? 'pending';
  const sd = STATUS_DISPLAY[vStatus] ?? STATUS_DISPLAY.pending;
  const isVerified = vStatus === 'verified';
  const isRanked = run.mode === 'ranked';
  const isPractice = run.mode === 'practice';
  const isPb = run.backendResult?.isPb ?? false;
  const previousBestMs = run.backendResult?.previousBestMs ?? null;
  const pbDeltaMs = isPb && previousBestMs ? previousBestMs - run.durationMs : null;
  const pbDeltaText = pbDeltaMs && pbDeltaMs > 0
    ? `${(pbDeltaMs / 1000).toFixed(1)}s szybciej`
    : isPb && !previousBestMs
      ? 'Pierwszy rekord na tej trasie'
      : null;
  const rankPosition = run.backendResult?.leaderboardResult?.position ?? 0;
  const rankDelta = run.backendResult?.leaderboardResult?.delta ?? 0;
  const xpBreakdown = calculateRunXp({
    isEligible: v?.isLeaderboardEligible ?? false,
    isPractice,
    isPb,
    position: rankPosition || null,
    previousPosition: run.backendResult?.leaderboardResult?.previousPosition ?? null,
  });
  const xpAwarded = run.backendResult?.run?.xp_awarded ?? xpBreakdown.total;
  const showRank = isRanked && isVerified && rankPosition > 0;
  const isSaving = run.saveStatus === 'saving' || run.saveStatus === 'pending';
  const isSaved = run.saveStatus === 'saved';
  const isFailed = run.saveStatus === 'failed';
  const isQueued = run.saveStatus === 'queued';

  // Level-up detection: compare current profile XP with XP before this run
  const currentXp = currentProfile?.xp ?? 0;
  const xpBeforeRun = Math.max(0, currentXp - xpAwarded);
  const levelBefore = getLevel(xpBeforeRun);
  const levelAfter = getLevel(currentXp);
  const isLevelUp = isSaved && xpAwarded > 0 && levelAfter > levelBefore;

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

        {/* ═══ SAVE STATUS — immediately after time, before celebrations ═══ */}
        {/* User must know immediately: did this save? */}
        <View style={styles.saveRow}>
          {/* Mutually exclusive save states — only ONE badge renders */}
          {isSaving ? (
            <View style={styles.savingBadge}>
              <ActivityIndicator size="small" color={colors.accent} />
              <Text style={styles.savingText}>ZAPISUJĘ DO LIGI…</Text>
            </View>
          ) : (isFailed || run.saveStatus === 'offline') && !isPractice ? (
            <View style={styles.saveFailCard}>
              <Text style={styles.saveFailTitle}>
                {run.saveStatus === 'offline' ? 'ZAPISANO LOKALNIE' : 'ZAPIS NIE POWIÓDŁ SIĘ'}
              </Text>
              <Text style={styles.saveFailBody}>
                {run.saveStatus === 'offline'
                  ? 'Brak internetu. Wyślę automatycznie gdy wrócisz online.'
                  : 'Zjazd zapisany lokalnie. Możesz spróbować ponownie.'}
              </Text>
              {isFailed && !!run.userId && (
                <Pressable
                  style={[styles.retryInlineBtn, retrying && { opacity: 0.5 }]}
                  onPress={handleRetrySave}
                  disabled={retrying}
                >
                  <Text style={styles.retryInlineBtnText}>
                    {retrying ? 'ZAPISUJĘ…' : 'PONÓW ZAPIS'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : isQueued ? (
            <View style={styles.saveQueuedCard}>
              <Text style={styles.saveQueuedTitle}>CZEKA NA WYSŁANIE</Text>
              <Text style={styles.saveQueuedBody}>
                Zjazd w kolejce. Wyślę automatycznie.
              </Text>
              {!!run.userId && (
                <Pressable
                  style={[styles.retryInlineBtn, retrying && { opacity: 0.5 }]}
                  onPress={handleRetrySave}
                  disabled={retrying}
                >
                  <Text style={styles.retryInlineBtnText}>
                    {retrying ? 'ZAPISUJĘ…' : 'WYŚLIJ TERAZ'}
                  </Text>
                </Pressable>
              )}
            </View>
          ) : isPractice ? (
            <View style={styles.savePracticeBadge}>
              <Text style={styles.savePracticeText}>TRENING ZAPISANY</Text>
            </View>
          ) : isSaved && isVerified ? (
            <View style={styles.saveOfficialBadge}>
              <Text style={styles.saveOfficialText}>✓ WYNIK W LIDZE</Text>
            </View>
          ) : isSaved && !isVerified && isRanked ? (
            <View style={styles.saveSavedBadge}>
              <Text style={styles.saveSavedText}>ZAPISANY · POZA RANKINGIEM</Text>
            </View>
          ) : null}
        </View>

        {/* ═══ PB CELEBRATION ═══ */}
        {isPb && (
          <View style={styles.pbCard}>
            <Text style={styles.pbIcon}>▲</Text>
            <Text style={styles.pbLabel}>PERSONAL BEST</Text>
            {pbDeltaText && (
              <Text style={styles.pbDelta}>{pbDeltaText}</Text>
            )}
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

        {/* ═══ XP REWARD ═══ */}
        {xpAwarded > 0 && (
          <View style={styles.xpRow}>
            <Text style={styles.xpValue}>+{xpAwarded} XP</Text>
            {xpBreakdown.reasons.length > 1 && (
              <Text style={styles.xpReasons}>
                {xpBreakdown.reasons.join(' · ')}
              </Text>
            )}
          </View>
        )}

        {/* ═══ LEVEL UP ═══ */}
        {isLevelUp && (
          <View style={styles.levelUpCard}>
            <Text style={styles.levelUpLabel}>LEVEL UP</Text>
            <Text style={styles.levelUpNumber}>{levelAfter}</Text>
          </View>
        )}

        {/* ═══ QUALITY BADGE ═══ */}
        {run.qualityTier && isRanked && isVerified && (
          <View style={styles.qualityRow}>
            <View style={[
              styles.qualityBadge,
              run.qualityTier === 'perfect' && { borderColor: colors.accent + '40' },
              run.qualityTier === 'rough' && { borderColor: colors.orange + '40' },
            ]}>
              <Text style={[
                styles.qualityDot,
                { color: run.qualityTier === 'perfect' ? colors.accent
                  : run.qualityTier === 'valid' ? colors.textSecondary
                  : colors.orange },
              ]}>●</Text>
              <Text style={[
                styles.qualityText,
                { color: run.qualityTier === 'perfect' ? colors.accent
                  : run.qualityTier === 'valid' ? colors.textSecondary
                  : colors.orange },
              ]}>
                {run.qualityTier === 'perfect' ? 'CZYSTY PRZEJAZD'
                  : run.qualityTier === 'valid' ? 'ZALICZONY'
                  : 'OGRANICZONA PRECYZJA'}
              </Text>
            </View>
          </View>
        )}

        {/* ═══ STATUS CONTEXT — soft human explanation ═══ */}
        {!isVerified && !isPractice && vStatus !== 'pending' && (
          <View style={styles.statusContextCard}>
            <Text style={[styles.statusContextLabel, { color: sd.color }]}>{sd.label}</Text>
            <Text style={styles.statusContextBody}>{sd.description}</Text>
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
        {/* Field test debug — dev builds only */}
        {__DEV__ && (
          <View style={styles.debugCard}>
            <Text style={styles.debugTitle}>DANE ZJAZDU</Text>
            <Text style={styles.debugLine}>Trail: {run.trailId}</Text>
            <Text style={styles.debugLine}>Mode: {run.mode}</Text>
            <Text style={styles.debugLine}>Verification: {vStatus}</Text>
            <Text style={styles.debugLine}>Leaderboard eligible: {v?.isLeaderboardEligible ? 'YES' : 'NO'}</Text>
            <Text style={styles.debugLine}>Quality: {run.qualityTier ?? 'N/A'}</Text>
            <Text style={styles.debugLine}>Save: {run.saveStatus}</Text>
            <Text style={styles.debugLine}>Duration: {run.durationMs}ms</Text>
            {v?.checkpointsPassed != null && (
              <Text style={styles.debugLine}>Checkpoints: {v.checkpointsPassed}/{v.checkpointsTotal}</Text>
            )}
            <Text style={styles.debugLine}>Session: {run.sessionId?.slice(0, 12)}…</Text>
          </View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════════
// PIONEER RESULT SCREEN
// Distinct celebration for the first-ever run on a trail.
// DB is the source of truth (no runStore); we fetch run + trail + spot
// and render a Crown hero + stats + "WRÓĆ DO TRASY" CTA.
// ═══════════════════════════════════════════════════════════

const TERRAIN_GRADIENT: readonly [string, string, string] = [
  hudColors.terrainHigh,
  hudColors.terrainMid,
  hudColors.terrainDark,
];

/** Simple crown path — five peaks, flat base. Drawn in a 40×28 viewBox. */
const CROWN_PATH = 'M2 22 L8 8 L14 18 L20 4 L26 18 L32 8 L38 22 L38 26 L2 26 Z';

function PioneerResultScreen({ runId }: { runId: string }) {
  const router = useRouter();
  const { run } = useRun(runId);
  const { trail } = useTrail(run?.trail_id ?? null);
  const { spot } = useSpot(trail?.spotId ?? null);

  const pulseAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.0, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  const goToTrail = () => {
    tapLight();
    if (trail?.id) router.replace(`/trail/${trail.id}`);
    else router.replace('/');
  };

  if (!run) {
    return (
      <View style={pioneerStyles.root}>
        <LinearGradient colors={TERRAIN_GRADIENT} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={pioneerStyles.safe}>
          <View style={pioneerStyles.centered}>
            <ActivityIndicator color={hudColors.gpsStrong} />
            <Text style={pioneerStyles.loadingLabel}>WCZYTUJĘ ZJAZD…</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  const durationMs = run.duration_ms ?? 0;
  const trailName = trail?.name ?? 'TRASA';
  const spotName = spot?.name;

  return (
    <View style={pioneerStyles.root}>
      <LinearGradient colors={TERRAIN_GRADIENT} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={pioneerStyles.safe} edges={['top', 'bottom']}>
        <View style={pioneerStyles.hero}>
          <Animated.View style={[pioneerStyles.crownWrap, { opacity: pulseAnim }, hudShadows.glowGreen]}>
            <Svg width={72} height={50} viewBox="0 0 40 28">
              <Path d={CROWN_PATH} fill={hudColors.gpsStrong} />
            </Svg>
          </Animated.View>

          <Text style={pioneerStyles.heroTitle}>PIERWSZY PIONIER</Text>
          <Text style={pioneerStyles.heroSubtitle}>
            Ta trasa zostanie pamiętana jako twoja kalibracja
          </Text>

          <Text style={pioneerStyles.heroTime}>{formatTime(durationMs)}</Text>
          <Text style={pioneerStyles.rankLabel}>#1 WSZECH CZASÓW</Text>
        </View>

        <View style={pioneerStyles.statsBlock}>
          <Text style={pioneerStyles.trailName}>{trailName}</Text>
          {spotName && <Text style={pioneerStyles.spotName}>{spotName.toUpperCase()}</Text>}
        </View>

        <View style={pioneerStyles.footer}>
          <Pressable
            onPress={goToTrail}
            style={({ pressed }) => [
              pioneerStyles.cta,
              hudShadows.glowGreen,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={pioneerStyles.ctaLabel}>WRÓĆ DO TRASY</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const pioneerStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: hudColors.terrainDark },
  safe: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingLabel: {
    ...hudTypography.label,
    color: hudColors.gpsStrong,
    letterSpacing: 4,
  },
  hero: {
    paddingTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  crownWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heroTitle: {
    ...hudTypography.displayLarge,
    fontSize: 36,
    color: hudColors.gpsStrong,
    letterSpacing: 4,
    textAlign: 'center',
    textShadowColor: hudColors.gpsStrong,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    ...hudTypography.label,
    color: hudColors.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: spacing.xl,
    maxWidth: 320,
  },
  heroTime: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 48,
    color: hudColors.timerPrimary,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'] as any,
    textShadowColor: hudColors.gpsStrong,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    marginBottom: spacing.xs,
  },
  rankLabel: {
    ...hudTypography.label,
    fontSize: 12,
    color: hudColors.gpsStrong,
    letterSpacing: 4,
  },
  statsBlock: {
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
  },
  trailName: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 22,
    color: hudColors.timerPrimary,
    letterSpacing: 2,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  spotName: {
    ...hudTypography.labelSmall,
    color: hudColors.textMuted,
    letterSpacing: 3,
  },
  footer: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  cta: {
    backgroundColor: hudColors.actionPrimary,
    borderRadius: radii.lg,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: {
    ...hudTypography.action,
    fontSize: 16,
    color: hudColors.terrainDark,
    letterSpacing: 3,
  },
});

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
  timeContainer: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.lg },
  timeHero: { fontFamily: 'Orbitron_700Bold', fontSize: 64, color: colors.textPrimary, letterSpacing: 3 },

  // PB celebration
  pbCard: {
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    borderRadius: radii.md,
    paddingVertical: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent + '60',
    gap: spacing.xxs,
  },
  pbIcon: { fontFamily: 'Orbitron_700Bold', fontSize: 12, color: colors.accent },
  pbLabel: { fontFamily: 'Orbitron_700Bold', fontSize: 14, color: colors.accent, letterSpacing: 5 },
  pbDelta: { fontFamily: 'Orbitron_700Bold', fontSize: 11, color: colors.accent, letterSpacing: 1, marginTop: spacing.xs, opacity: 0.8 },

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
  xpRow: { alignItems: 'center', marginBottom: spacing.md, gap: spacing.xxs },
  xpValue: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: colors.gold, letterSpacing: 2 },
  xpReasons: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 1, fontSize: 9 },

  // Level up
  levelUpCard: {
    alignItems: 'center', backgroundColor: colors.accentDim,
    borderRadius: radii.md, paddingVertical: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.accent + '50', gap: spacing.xxs,
  },
  levelUpLabel: { ...typography.labelSmall, color: colors.accent, letterSpacing: 4, fontSize: 10 },
  levelUpNumber: { fontFamily: 'Orbitron_700Bold', fontSize: 28, color: colors.accent, letterSpacing: 2 },

  // Quality badge
  qualityRow: { alignItems: 'center', marginBottom: spacing.md },
  qualityBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.bgCard, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border },
  qualityDot: { fontSize: 8 },
  qualityText: { ...typography.labelSmall, letterSpacing: 2, fontSize: 9 },

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
  // Failed/offline — card with inline retry
  saveFailCard: {
    backgroundColor: 'rgba(255,149,0,0.06)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.15)',
  },
  saveFailTitle: { ...typography.labelSmall, color: colors.orange, letterSpacing: 2, fontSize: 10 },
  saveFailBody: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  // Queued — card with send-now
  saveQueuedCard: {
    backgroundColor: 'rgba(255,204,0,0.05)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255,204,0,0.12)',
  },
  saveQueuedTitle: { ...typography.labelSmall, color: colors.gold, letterSpacing: 2, fontSize: 10 },
  saveQueuedBody: { ...typography.bodySmall, color: colors.textTertiary, textAlign: 'center', fontSize: 12, lineHeight: 18 },
  // Inline retry button (used in both fail and queued cards)
  retryInlineBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,149,0,0.40)',
    borderRadius: radii.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xs,
  },
  retryInlineBtnText: { ...typography.labelSmall, color: colors.orange, letterSpacing: 2, fontSize: 10 },

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

  // (retry card merged into saveFailCard / saveQueuedCard above)

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

  // Field test debug card
  debugCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  debugTitle: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, fontSize: 8, marginBottom: spacing.sm },
  debugLine: { fontFamily: 'Inter_400Regular', fontSize: 10, color: 'rgba(255, 255, 255, 0.25)', lineHeight: 16 },
});
