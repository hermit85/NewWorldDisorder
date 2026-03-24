import { useState } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import { getScenario, defaultScenario } from '@/data/mock/resultScenarios';
import {
  verificationScenarios,
  VerificationScenarioId,
  buildTruthMapData,
} from '@/data/mock/verificationScenarios';
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

export default function ResultScreen() {
  const { scenarioId, actualTimeMs, verificationId, mode } = useLocalSearchParams<{
    scenarioId: string;
    actualTimeMs: string;
    verificationId: string;
    mode: string;
  }>();
  const router = useRouter();
  const [showTruthMap, setShowTruthMap] = useState(false);

  const scenario = getScenario(scenarioId) ?? defaultScenario;
  const vKey = (verificationId ?? 'verifiedClean') as VerificationScenarioId;
  const verification = verificationScenarios[vKey] ?? verificationScenarios.verifiedClean;
  const truthMapData = buildTruthMapData(scenario.trailId, verification);

  const handleRunAgain = () => {
    router.replace({
      pathname: '/run/active',
      params: { trailId: scenario.trailId, trailName: scenario.trailName },
    });
  };

  const handleViewLeaderboard = () => {
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
          durationMs={scenario.durationMs}
          isPb={scenario.isPb}
          trailName={scenario.trailName}
        />

        {/* PB badge */}
        <ResultPBBadge
          isPb={scenario.isPb}
          improvementMs={scenario.pbImprovementMs}
        />

        {/* Rank position + delta (only for ranked verified) */}
        {verification.isLeaderboardEligible && (
          <ResultRankDelta
            position={scenario.rankPosition}
            delta={scenario.positionDelta}
          />
        )}

        {/* Gap to next target */}
        {verification.isLeaderboardEligible && scenario.gapToNextMs > 0 && (
          <ResultGapCard
            gapMs={scenario.gapToNextMs}
            targetPosition={scenario.nextTargetPosition}
            targetUsername={scenario.nextTargetUsername}
          />
        )}

        {/* Rank up */}
        {scenario.rankUp && verification.isLeaderboardEligible && (
          <ResultRankUp
            from={scenario.rankUp.from}
            to={scenario.rankUp.to}
          />
        )}

        {/* Achievement */}
        <ResultAchievementUnlock achievement={scenario.achievementUnlocked} />

        {/* XP */}
        <ResultXpMeter xpGained={scenario.xpGained} />

        {/* Verification status — NEW */}
        <ResultVerificationStatus
          verification={verification}
          onShowTruthMap={() => setShowTruthMap(!showTruthMap)}
        />

        {/* Truth map — expandable */}
        {showTruthMap && <TruthMap data={truthMapData} />}

        {/* Challenge progress */}
        {scenario.challengeProgress && (
          <ResultChallengeProgress
            challengeName={scenario.challengeProgress.challengeName}
            current={scenario.challengeProgress.current}
            target={scenario.challengeProgress.target}
            justCompleted={scenario.challengeProgress.justCompleted}
          />
        )}

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
});
