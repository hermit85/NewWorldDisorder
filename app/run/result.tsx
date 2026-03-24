// ═══════════════════════════════════════════════════════════
// Result Screen — the emotional heart of the product
// Every run ends here. This screen creates "one more run."
// Uses REAL backend data. No mock scenarios.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailById } from '@/data/seed/slotwinyOfficial';
import { XP_TABLE } from '@/systems/xp';
import { formatTime } from '@/content/copy';
import { tapLight, tapHeavy, notifySuccess, notifyWarning } from '@/systems/haptics';

// ── Verification display config (no mock dependency) ──
const VERIFICATION_DISPLAY: Record<string, { label: string; color: string; bg: string; icon: string; issues: string[] }> = {
  verifiedClean:     { label: 'VERIFIED',          color: colors.accent, bg: colors.accentDim,             icon: '✓', issues: [] },
  practiceRun:       { label: 'PRACTICE',           color: colors.blue,   bg: 'rgba(0,122,255,0.15)',      icon: '○', issues: [] },
  weakSignal:        { label: 'WEAK SIGNAL',        color: colors.orange, bg: 'rgba(255,149,0,0.15)',      icon: '!', issues: ['Weak GPS signal during run'] },
  missingCheckpoint: { label: 'CHECKPOINT MISSED',  color: colors.orange, bg: 'rgba(255,149,0,0.15)',      icon: '!', issues: ['One or more checkpoints missed'] },
  shortcutDetected:  { label: 'SHORTCUT DETECTED',  color: colors.red,    bg: 'rgba(255,59,48,0.12)',      icon: '✕', issues: ['Off-route shortcut detected'] },
  outsideStartGate:  { label: 'NO START GATE',      color: colors.red,    bg: 'rgba(255,59,48,0.12)',      icon: '✕', issues: ['Did not enter start gate'] },
};

export default function ResultScreen() {
  const params = useLocalSearchParams<{
    actualTimeMs: string;
    verificationId: string;
    mode: string;
    trailId: string;
    trailName: string;
    saved: string;
    isPb: string;
    rankPosition: string;
    rankDelta: string;
    xpAwarded: string;
  }>();
  const router = useRouter();
  const [showTruthMap, setShowTruthMap] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  // ── Parse real data ──
  const actualTime = parseInt(params.actualTimeMs ?? '0', 10);
  const trailId = params.trailId ?? 'dzida-czerwona';
  const trail = getTrailById(trailId);
  const trailName = params.trailName ?? trail?.officialName ?? 'Unknown Trail';
  const mode = params.mode ?? 'practice';
  const saved = params.saved === '1';
  const isPb = params.isPb === '1';
  const rankPosition = parseInt(params.rankPosition ?? '0', 10) || 0;
  const rankDelta = parseInt(params.rankDelta ?? '0', 10) || 0;
  const xpAwarded = parseInt(params.xpAwarded ?? '0', 10) || (saved ? XP_TABLE.validRun : 0);

  const isRanked = mode === 'ranked';
  const vKey = params.verificationId ?? 'verifiedClean';
  const vDisplay = VERIFICATION_DISPLAY[vKey] ?? VERIFICATION_DISPLAY.practiceRun;
  const isVerified = vKey === 'verifiedClean';
  const showRank = isRanked && isVerified && rankPosition > 0;

  // ── Entrance animation + haptics ──
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    if (isPb) {
      tapHeavy();
      setTimeout(() => notifySuccess(), 200);
      setTimeout(() => notifySuccess(), 500);
    } else if (saved) {
      notifySuccess();
    } else if (mode === 'practice') {
      notifyWarning();
    }
  }, []);

  const handleRunAgain = () => {
    tapLight();
    router.replace({
      pathname: '/run/active',
      params: { trailId, trailName },
    });
  };

  const handleViewLeaderboard = () => {
    tapLight();
    router.replace('/(tabs)/leaderboard');
  };

  // Status display from verification key — no mock dependency
  const statusConfig = vDisplay;

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
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <Text style={[styles.statusIcon, { color: statusConfig.color }]}>{statusConfig.icon}</Text>
            <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
          </View>
        </View>

        {/* ── THE TIME — hero element ── */}
        <View style={styles.timeContainer}>
          <Text style={[styles.timeHero, isPb && { color: colors.accent }]}>
            {formatTime(actualTime)}
          </Text>
        </View>

        {/* ── PB celebration ── */}
        {isPb && (
          <View style={styles.pbCard}>
            <Text style={styles.pbLabel}>NEW PERSONAL BEST</Text>
          </View>
        )}

        {/* ── Rank position (real from backend) ── */}
        {showRank && (
          <View style={styles.rankCard}>
            <View style={styles.rankRow}>
              <Text style={styles.rankPosition}>#{rankPosition}</Text>
              {rankDelta > 0 && (
                <View style={styles.deltaUp}>
                  <Text style={styles.deltaUpText}>↑{rankDelta}</Text>
                </View>
              )}
              {rankDelta < 0 && (
                <Text style={styles.deltaDown}>↓{Math.abs(rankDelta)}</Text>
              )}
              {rankDelta === 0 && rankPosition > 0 && (
                <Text style={styles.deltaFlat}>NEW ENTRY</Text>
              )}
            </View>
            <Text style={styles.rankLabel}>LEADERBOARD POSITION</Text>
          </View>
        )}

        {/* ── XP awarded ── */}
        {xpAwarded > 0 && (
          <View style={styles.xpRow}>
            <Text style={styles.xpValue}>+{xpAwarded} XP</Text>
          </View>
        )}

        {/* ── Save status ── */}
        <View style={styles.saveRow}>
          {saved ? (
            <View style={styles.saveOkBadge}>
              <Text style={styles.saveOkText}>✓ SAVED TO LEAGUE</Text>
            </View>
          ) : mode === 'practice' ? (
            <View style={styles.savePracticeBadge}>
              <Text style={styles.savePracticeText}>PRACTICE — NOT ON BOARD</Text>
            </View>
          ) : (
            <View style={styles.saveFailBadge}>
              <Text style={styles.saveFailText}>NOT SAVED — TRY AGAIN</Text>
            </View>
          )}
        </View>

        {/* ── Verification issues ── */}
        {vDisplay.issues.length > 0 && (
          <View style={styles.issuesCard}>
            {vDisplay.issues.map((issue, i) => (
              <Text key={i} style={styles.issueText}>• {issue}</Text>
            ))}
          </View>
        )}

        {/* ── Sync failure explanation ── */}
        {!saved && isRanked && isVerified && (
          <View style={styles.syncFailCard}>
            <Text style={styles.syncFailTitle}>YOUR RUN WAS VALID</Text>
            <Text style={styles.syncFailBody}>
              The run passed verification but could not be saved. This may be a connection issue. Your time was real — try again when signal is stable.
            </Text>
          </View>
        )}

        {/* ── Divider ── */}
        <View style={styles.divider} />

        {/* ── CTAs ── */}
        <Pressable style={styles.runAgainBtn} onPress={handleRunAgain}>
          <Text style={styles.runAgainText}>RUN AGAIN</Text>
        </Pressable>

        <Pressable style={styles.leaderboardBtn} onPress={handleViewLeaderboard}>
          <Text style={styles.leaderboardBtnText}>VIEW LEADERBOARD</Text>
        </Pressable>
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.huge,
  },

  // Header
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  trailLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 4,
    fontSize: 11,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xxs,
  },
  statusIcon: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  statusText: {
    ...typography.labelSmall,
    letterSpacing: 2,
    fontSize: 10,
  },

  // Time — the hero
  timeContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  timeHero: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 64,
    color: colors.textPrimary,
    letterSpacing: 4,
  },

  // PB
  pbCard: {
    alignItems: 'center',
    backgroundColor: colors.accentDim,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  pbLabel: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 16,
    color: colors.accent,
    letterSpacing: 4,
  },

  // Rank
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
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rankPosition: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 36,
    color: colors.textPrimary,
  },
  deltaUp: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  deltaUpText: {
    ...typography.label,
    color: colors.accent,
    fontSize: 16,
  },
  deltaDown: {
    ...typography.label,
    color: colors.red,
    fontSize: 16,
  },
  deltaFlat: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  rankLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 3,
    marginTop: spacing.sm,
  },

  // XP
  xpRow: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  xpValue: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 18,
    color: colors.gold,
    letterSpacing: 2,
  },

  // Save status
  saveRow: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  saveOkBadge: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  saveOkText: {
    ...typography.labelSmall,
    color: colors.accent,
    letterSpacing: 2,
  },
  savePracticeBadge: {
    backgroundColor: 'rgba(0,122,255,0.1)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  savePracticeText: {
    ...typography.labelSmall,
    color: colors.blue,
    letterSpacing: 1,
  },
  saveFailBadge: {
    backgroundColor: 'rgba(255,149,0,0.1)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  saveFailText: {
    ...typography.labelSmall,
    color: colors.orange,
    letterSpacing: 1,
  },

  // Sync failure
  syncFailCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.orange,
  },
  syncFailTitle: {
    ...typography.labelSmall,
    color: colors.orange,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  syncFailBody: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  // Issues
  issuesCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  issueText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    lineHeight: 20,
  },

  // Truth map
  truthMapToggle: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  truthMapToggleText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 2,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },

  // CTAs
  runAgainBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  runAgainText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 16,
    color: colors.bg,
    letterSpacing: 4,
  },
  leaderboardBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  leaderboardBtnText: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 3,
  },
});
