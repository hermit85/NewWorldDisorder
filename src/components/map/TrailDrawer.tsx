import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { trailLineColors } from '@/theme/map';
import { Trail, Difficulty } from '@/data/types';
import { UserTrailStats } from '@/data/mock/userTrailStats';
import { getActiveChallenges } from '@/data/mock/challenges';
import { formatTime, formatTimeShort, copy } from '@/content/copy';
import { tapLight, tapMedium } from '@/systems/haptics';

interface Props {
  trail: Trail;
  stats: UserTrailStats | undefined;
  onClose: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function TrailDrawer({ trail, stats, onClose }: Props) {
  const router = useRouter();
  const diffColor = trailLineColors[trail.difficulty];
  const challenges = getActiveChallenges(trail.spotId).filter(
    (c) => c.trailId === trail.id || c.trailId === null
  );
  const activeChallenge = challenges[0];

  const handleStartRun = () => {
    tapMedium();
    router.push({
      pathname: '/run/active',
      params: { trailId: trail.id, trailName: trail.name },
    });
  };

  const handleViewTrail = () => {
    tapLight();
    router.push(`/trail/${trail.id}`);
  };

  return (
    <View style={styles.container}>
      {/* Drag handle */}
      <View style={styles.handle} />

      {/* Trail header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.badges}>
            <View style={[styles.diffBadge, { borderColor: diffColor }]}>
              <Text style={[styles.diffText, { color: diffColor }]}>
                {trail.difficulty.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.typeText}>{trail.trailType.toUpperCase()}</Text>
          </View>
          <Pressable onPress={handleViewTrail}>
            <Text style={styles.trailName}>{trail.name}</Text>
          </Pressable>
        </View>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{trail.distanceM}m</Text>
          <Text style={styles.statLabel}>DIST</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>↓{trail.elevationDropM}m</Text>
          <Text style={styles.statLabel}>DROP</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, stats?.pbMs ? { color: colors.accent } : {}]}>
            {stats?.pbMs ? formatTimeShort(stats.pbMs) : '—'}
          </Text>
          <Text style={styles.statLabel}>YOUR PB</Text>
        </View>
        {stats?.position && (
          <>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>#{stats.position}</Text>
              <Text style={styles.statLabel}>RANK</Text>
            </View>
          </>
        )}
      </View>

      {/* Nearest rival */}
      {stats?.nearestRival && (
        <View style={styles.rivalRow}>
          <Text style={styles.rivalLabel}>NEAREST RIVAL</Text>
          <Text style={styles.rivalInfo}>
            #{stats.nearestRival.position} {stats.nearestRival.username}
            <Text style={styles.rivalGap}>
              {' '}
              · {(stats.nearestRival.gapMs / 1000).toFixed(1)}s ahead
            </Text>
          </Text>
        </View>
      )}

      {/* Top 3 mini-leaderboard */}
      {stats?.top3 && stats.top3.length > 0 && (
        <View style={styles.top3Row}>
          {stats.top3.map((entry) => (
            <View key={entry.position} style={styles.top3Item}>
              <Text
                style={[
                  styles.top3Position,
                  entry.position === 1 && { color: colors.gold },
                ]}
              >
                #{entry.position}
              </Text>
              <Text style={styles.top3Name} numberOfLines={1}>
                {entry.username}
              </Text>
              <Text style={styles.top3Time}>{formatTimeShort(entry.timeMs)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Active challenge */}
      {activeChallenge && (
        <View style={styles.challengeRow}>
          <Text style={styles.challengeIcon}>⚡</Text>
          <View style={styles.challengeInfo}>
            <Text style={styles.challengeName}>{activeChallenge.name}</Text>
            <View style={styles.challengeBar}>
              <View
                style={[
                  styles.challengeBarFill,
                  {
                    width: `${(activeChallenge.currentProgress / activeChallenge.targetProgress) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
      )}

      {/* Start Run CTA */}
      <Pressable style={styles.startBtn} onPress={handleStartRun}>
        <Text style={styles.startBtnText}>{copy.startRun.toUpperCase()}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  diffBadge: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  diffText: {
    ...typography.labelSmall,
  },
  typeText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  trailName: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    ...typography.h3,
    color: colors.textPrimary,
    fontSize: 15,
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  rivalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rivalLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  rivalInfo: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  rivalGap: {
    color: colors.orange,
    fontFamily: 'Inter_400Regular',
  },
  top3Row: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  top3Item: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    padding: spacing.sm,
    alignItems: 'center',
  },
  top3Position: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  top3Name: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 2,
  },
  top3Time: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 10,
    marginTop: 2,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  challengeIcon: {
    fontSize: 18,
  },
  challengeInfo: {
    flex: 1,
  },
  challengeName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: spacing.xs,
  },
  challengeBar: {
    height: 3,
    backgroundColor: colors.bg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  challengeBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
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
    letterSpacing: 3,
  },
});
