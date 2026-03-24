// ═══════════════════════════════════════════════════════════
// Result Screen — post-run dopamine delivery
// Now uses REAL run data from params. Mock only as safe fallback.
// ═══════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import {
  verificationScenarios,
  VerificationScenarioId,
  buildTruthMapData,
} from '@/data/mock/verificationScenarios';
import { getTrailById } from '@/data/seed/slotwinyOfficial';
import { ResultTimeCard } from '@/components/result/ResultTimeCard';
import { ResultPBBadge } from '@/components/result/ResultPBBadge';
import { ResultRankDelta } from '@/components/result/ResultRankDelta';
import { ResultGapCard } from '@/components/result/ResultGapCard';
import { ResultXpMeter } from '@/components/result/ResultXpMeter';
import { ResultAchievementUnlock } from '@/components/result/ResultAchievementUnlock';
import { ResultChallengeProgress } from '@/components/result/ResultChallengeProgress';
import { ResultRankUp } from '@/components/result/ResultRankUp';
import { RunAgainCTA } from '@/components/result/RunAgainCTA';
import { ResultVerificationStatus } from '@/components/result/ResultVerificationStatus';
import { TruthMap } from '@/components/map/TruthMap';
import { XP_TABLE } from '@/systems/xp';
import { tapLight, notifySuccess } from '@/systems/haptics';

export default function ResultScreen() {
  const params = useLocalSearchParams<{
    scenarioId: string;
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

  // ── Haptic celebration on mount ──
  useEffect(() => {
    const isPbVal = params.isPb === '1';
    const savedVal = params.saved === '1';
    if (isPbVal) {
      // Double haptic for PB
      notifySuccess();
      setTimeout(() => notifySuccess(), 300);
    } else if (savedVal) {
      notifySuccess();
    }
  }, []);

  // ── Parse real data from params ──
  const actualTime = parseInt(params.actualTimeMs ?? '0', 10);
  const trailId = params.trailId ?? params.scenarioId?.split('-')[0] ?? 'dzida-czerwona';
  const trail = getTrailById(trailId);
  const trailName = params.trailName ?? trail?.officialName ?? 'Unknown Trail';
  const mode = params.mode ?? 'practice';
  const saved = params.saved === '1';
  const isPb = params.isPb === '1';
  const rankPosition = parseInt(params.rankPosition ?? '0', 10) || 0;
  const rankDelta = parseInt(params.rankDelta ?? '0', 10) || 0;
  const xpAwarded = parseInt(params.xpAwarded ?? '0', 10) || (saved ? XP_TABLE.validRun : 0);

  // ── Verification scenario (mock display data for visual treatment) ──
  const vKey = (params.verificationId ?? 'verifiedClean') as VerificationScenarioId;
  const verification = verificationScenarios[vKey] ?? verificationScenarios.verifiedClean;
  const truthMapData = buildTruthMapData(trailId, verification);

  const isRanked = mode === 'ranked';
  const isVerified = vKey === 'verifiedClean' || verification.isLeaderboardEligible;
  const showLeaderboardInfo = isRanked && isVerified && rankPosition > 0;

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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Time — the hero */}
        <ResultTimeCard
          durationMs={actualTime}
          isPb={isPb}
          trailName={trailName}
        />

        {/* PB badge */}
        <ResultPBBadge
          isPb={isPb}
          improvementMs={null}
        />

        {/* Rank position + delta (real from backend) */}
        {showLeaderboardInfo && (
          <ResultRankDelta
            position={rankPosition}
            delta={rankDelta}
          />
        )}

        {/* XP */}
        <ResultXpMeter xpGained={xpAwarded} />

        {/* Verification status */}
        <ResultVerificationStatus
          verification={verification}
          onShowTruthMap={() => setShowTruthMap(!showTruthMap)}
        />

        {/* Backend save status */}
        <View style={styles.saveStatus}>
          {saved ? (
            <Text style={styles.saveOk}>✓ RUN SAVED TO LEAGUE</Text>
          ) : mode === 'practice' ? (
            <Text style={styles.savePractice}>PRACTICE — NOT ON BOARD</Text>
          ) : (
            <Text style={styles.saveFail}>RUN NOT SAVED — CHECK CONNECTION</Text>
          )}
        </View>

        {/* Truth map — expandable */}
        {showTruthMap && <TruthMap data={truthMapData} />}

        {/* CTAs */}
        <RunAgainCTA
          onRunAgain={handleRunAgain}
          onViewLeaderboard={handleViewLeaderboard}
        />
      </ScrollView>
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
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.huge,
  },
  saveStatus: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    marginVertical: spacing.sm,
  },
  saveOk: {
    ...typography.labelSmall,
    color: colors.accent,
    letterSpacing: 2,
  },
  savePractice: {
    ...typography.labelSmall,
    color: colors.blue,
    letterSpacing: 2,
  },
  saveFail: {
    ...typography.labelSmall,
    color: colors.orange,
    letterSpacing: 1,
  },
});
