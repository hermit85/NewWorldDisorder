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
import { getFinalizedRun, subscribeFinalizedRun, FinalizedRun } from '@/systems/runStore';

// ── Verification display config ──
const V_DISPLAY: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  verified:              { label: 'VERIFIED',           color: colors.accent, bg: colors.accentDim,         icon: '✓' },
  practice_only:         { label: 'PRACTICE',            color: colors.blue,   bg: 'rgba(0,122,255,0.15)',  icon: '○' },
  weak_signal:           { label: 'WEAK SIGNAL',         color: colors.orange, bg: 'rgba(255,149,0,0.15)',  icon: '!' },
  missing_checkpoint:    { label: 'CHECKPOINT MISSED',   color: colors.orange, bg: 'rgba(255,149,0,0.15)',  icon: '!' },
  shortcut_detected:     { label: 'SHORTCUT DETECTED',   color: colors.red,    bg: 'rgba(255,59,48,0.12)',  icon: '✕' },
  outside_start_gate:    { label: 'NO START GATE',       color: colors.red,    bg: 'rgba(255,59,48,0.12)',  icon: '✕' },
  outside_finish_gate:   { label: 'NO FINISH GATE',      color: colors.red,    bg: 'rgba(255,59,48,0.12)',  icon: '✕' },
  invalid_route:         { label: 'ROUTE BROKEN',        color: colors.red,    bg: 'rgba(255,59,48,0.12)',  icon: '✕' },
  pending:               { label: 'VERIFYING',           color: colors.gold,   bg: 'rgba(255,204,0,0.12)',  icon: '…' },
};

export default function ResultScreen() {
  const { runSessionId } = useLocalSearchParams<{ runSessionId: string }>();
  const router = useRouter();
  const [fadeAnim] = useState(new Animated.Value(0));
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // ── Read from store + subscribe for live updates ──
  const run = runSessionId ? getFinalizedRun(runSessionId) : undefined;

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

  // ── Fallback if no run in store ──
  if (!run) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.fallback}>
          <Text style={styles.fallbackText}>Run data not found</Text>
          <Pressable style={styles.fallbackBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.fallbackBtnText}>BACK TO HOME</Text>
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
            <Text style={styles.pbLabel}>NEW PERSONAL BEST</Text>
          </View>
        )}

        {/* ── Rank position ── */}
        {showRank && (
          <View style={styles.rankCard}>
            <View style={styles.rankRow}>
              <Text style={styles.rankPosition}>#{rankPosition}</Text>
              {rankDelta > 0 && (
                <View style={styles.deltaUp}>
                  <Text style={styles.deltaUpText}>↑{rankDelta}</Text>
                </View>
              )}
              {rankDelta === 0 && rankPosition > 0 && (
                <Text style={styles.deltaFlat}>NEW ENTRY</Text>
              )}
            </View>
            <Text style={styles.rankLabel}>LEADERBOARD POSITION</Text>
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
              <Text style={styles.savingText}>SAVING TO LEAGUE...</Text>
            </View>
          )}
          {run.saveStatus === 'saved' && (
            <View style={styles.saveOkBadge}>
              <Text style={styles.saveOkText}>✓ SAVED TO LEAGUE</Text>
            </View>
          )}
          {run.saveStatus === 'failed' && (
            <View style={styles.saveFailBadge}>
              <Text style={styles.saveFailText}>SAVE FAILED — TRY AGAIN LATER</Text>
            </View>
          )}
          {run.saveStatus === 'offline' && run.mode === 'practice' && (
            <View style={styles.savePracticeBadge}>
              <Text style={styles.savePracticeText}>PRACTICE — NOT ON BOARD</Text>
            </View>
          )}
          {run.saveStatus === 'offline' && run.mode !== 'practice' && (
            <View style={styles.saveFailBadge}>
              <Text style={styles.saveFailText}>OFFLINE — NOT SAVED</Text>
            </View>
          )}
        </View>

        {/* ── Sync failure explanation ── */}
        {run.saveStatus === 'failed' && isRanked && isVerified && (
          <View style={styles.syncFailCard}>
            <Text style={styles.syncFailTitle}>YOUR RUN WAS VALID</Text>
            <Text style={styles.syncFailBody}>
              The run passed verification but could not be saved. This may be a connection issue. Your time was real — try again when signal is stable.
            </Text>
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

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── CTAs ── */}
        <Pressable style={styles.runAgainBtn} onPress={() => {
          tapLight();
          router.replace({ pathname: '/run/active', params: { trailId: run.trailId, trailName } });
        }}>
          <Text style={styles.runAgainText}>RUN AGAIN</Text>
        </Pressable>

        <Pressable style={styles.leaderboardBtn} onPress={() => {
          tapLight();
          router.replace('/(tabs)/leaderboard');
        }}>
          <Text style={styles.leaderboardBtnText}>VIEW LEADERBOARD</Text>
        </Pressable>
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

  rankCard: { alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radii.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rankPosition: { fontFamily: 'Orbitron_700Bold', fontSize: 36, color: colors.textPrimary },
  deltaUp: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  deltaUpText: { ...typography.label, color: colors.accent, fontSize: 16 },
  deltaFlat: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2 },
  rankLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, marginTop: spacing.sm },

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
  syncFailBody: { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 20 },

  issuesCard: { backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  issueText: { ...typography.bodySmall, color: colors.textTertiary, lineHeight: 20 },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.lg },

  runAgainBtn: { backgroundColor: colors.accent, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center', marginBottom: spacing.md },
  runAgainText: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: colors.bg, letterSpacing: 4 },
  leaderboardBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingVertical: spacing.md, alignItems: 'center' },
  leaderboardBtnText: { ...typography.label, color: colors.textSecondary, letterSpacing: 3 },
});
