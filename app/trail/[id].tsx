import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrail } from '@/data/mock/trails';
import { mockLeaderboard } from '@/data/mock/leaderboard';
import { copy, formatTime } from '@/content/copy';
import { Difficulty } from '@/data/types';

const difficultyColors: Record<Difficulty, string> = {
  easy: colors.diffEasy,
  medium: colors.diffMedium,
  hard: colors.diffHard,
  expert: colors.diffExpert,
  pro: colors.diffPro,
};

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const trail = getTrail(id);

  const goBack = () => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (!trail) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.textPrimary, padding: spacing.lg }}>Trail not found</Text>
      </SafeAreaView>
    );
  }

  // Get leaderboard for this trail
  const leaderboard = mockLeaderboard
    .filter((e) => e.trailId === trail.id)
    .slice(0, 5);
  const userEntry = mockLeaderboard.find(
    (e) => e.trailId === trail.id && e.isCurrentUser
  );

  // Mock PB
  const userPbMs = userEntry?.bestDurationMs;

  // Nearest rival (one position above user)
  const nearestRival = userEntry
    ? mockLeaderboard.find(
        (e) =>
          e.trailId === trail.id &&
          e.currentPosition === userEntry.currentPosition - 1
      )
    : null;

  const diffColor = difficultyColors[trail.difficulty];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back */}
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        {/* Trail header */}
        <View style={styles.header}>
          <View style={styles.badges}>
            <View style={[styles.badge, { borderColor: diffColor }]}>
              <Text style={[styles.badgeText, { color: diffColor }]}>
                {trail.difficulty.toUpperCase()}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {trail.trailType.toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.trailName}>{trail.name}</Text>
          <Text style={styles.trailDesc}>{trail.description}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{trail.distanceM}m</Text>
              <Text style={styles.statLabel}>DISTANCE</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{trail.elevationDropM}m</Text>
              <Text style={styles.statLabel}>DROP</Text>
            </View>
          </View>
        </View>

        {/* Your PB */}
        <View style={styles.pbCard}>
          <Text style={styles.label}>{copy.yourPb.toUpperCase()}</Text>
          <Text style={styles.pbTime}>
            {userPbMs ? formatTime(userPbMs) : copy.noPbYet}
          </Text>
          {userEntry && (
            <Text style={styles.pbPosition}>
              #{userEntry.currentPosition}
            </Text>
          )}
        </View>

        {/* Nearest rival */}
        {nearestRival && userEntry && (
          <View style={styles.rivalCard}>
            <Text style={styles.label}>{copy.nearestRival.toUpperCase()}</Text>
            <View style={styles.rivalRow}>
              <Text style={styles.rivalName}>
                #{nearestRival.currentPosition} {nearestRival.username}
              </Text>
              <Text style={styles.rivalGap}>
                {formatTime(nearestRival.bestDurationMs)}
              </Text>
            </View>
            <Text style={styles.rivalDelta}>
              {((userEntry.bestDurationMs - nearestRival.bestDurationMs) / 1000).toFixed(1)}s
              ahead of you
            </Text>
          </View>
        )}

        {/* Mini leaderboard */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.label}>{copy.topRiders.toUpperCase()}</Text>
          {leaderboard.map((entry) => (
            <View key={entry.userId} style={styles.lbRow}>
              <Text style={styles.lbPosition}>#{entry.currentPosition}</Text>
              <Text style={styles.lbName}>{entry.username}</Text>
              <Text style={styles.lbTime}>
                {formatTime(entry.bestDurationMs)}
              </Text>
            </View>
          ))}
          {userEntry && userEntry.currentPosition > 5 && (
            <>
              <Text style={styles.lbDots}>···</Text>
              <View style={[styles.lbRow, styles.lbRowHighlight]}>
                <Text style={styles.lbPosition}>
                  #{userEntry.currentPosition}
                </Text>
                <Text style={[styles.lbName, { color: colors.accent }]}>
                  {userEntry.username}
                </Text>
                <Text style={styles.lbTime}>
                  {formatTime(userEntry.bestDurationMs)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Spacer for CTA */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Start Run CTA */}
      <View style={styles.ctaContainer}>
        <Pressable
          style={styles.startBtn}
          onPress={() =>
            router.push({
              pathname: '/run/active',
              params: { trailId: trail.id, trailName: trail.name },
            })
          }
        >
          <Text style={styles.startBtnText}>
            {copy.startRun.toUpperCase()}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    padding: spacing.lg,
  },
  backBtn: {
    marginBottom: spacing.lg,
  },
  backText: {
    ...typography.body,
    color: colors.textSecondary,
  },
  header: {
    marginBottom: spacing.xl,
  },
  badges: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  badgeText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  trailName: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 32,
  },
  trailDesc: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  stat: {},
  statValue: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  pbCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
  },
  label: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  pbTime: {
    ...typography.timeLarge,
    color: colors.accent,
  },
  pbPosition: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  rivalCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rivalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rivalName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  rivalGap: {
    ...typography.timeSmall,
    color: colors.textSecondary,
  },
  rivalDelta: {
    ...typography.bodySmall,
    color: colors.orange,
    marginTop: spacing.xs,
  },
  leaderboardSection: {
    marginTop: spacing.lg,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lbRowHighlight: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 0,
  },
  lbPosition: {
    ...typography.label,
    color: colors.textTertiary,
    width: 40,
  },
  lbName: {
    ...typography.body,
    color: colors.textPrimary,
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
  },
  lbTime: {
    ...typography.timeSmall,
    color: colors.textSecondary,
  },
  lbDots: {
    ...typography.body,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    backgroundColor: colors.bg,
  },
  startBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  startBtnText: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 2,
  },
});
