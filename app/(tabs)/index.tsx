import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { trailLineColors } from '@/theme/map';
import { mockSpots } from '@/data/mock/spots';
import { mockTrails } from '@/data/mock/trails';
import { mockChallenges } from '@/data/mock/challenges';
import { mockUser } from '@/data/mock/user';
import { getUserTrailStats } from '@/data/mock/userTrailStats';
import { getRank, getXpToNextRank } from '@/systems/ranks';
import { copy, formatTimeShort } from '@/content/copy';
import { spotLore } from '@/data/seed/slotwinyLore';

export default function HomeScreen() {
  const router = useRouter();
  const spot = mockSpots[0];
  const hotTrail = mockTrails.find((t) => t.id === 'dzida-czerwona') ?? mockTrails[0];
  const activeChallenge = mockChallenges[0];
  const rank = getRank(mockUser.rankId);
  const xpProgress = getXpToNextRank(mockUser.xp);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>NWD</Text>
          <View style={styles.rankPill}>
            <Text style={[styles.rankIcon, { color: rank.color }]}>{rank.icon}</Text>
            <Text style={[styles.rankName, { color: rank.color }]}>{rank.name}</Text>
            <View style={styles.xpMini}>
              <View style={[styles.xpMiniFill, { width: `${xpProgress.progress * 100}%`, backgroundColor: rank.color }]} />
            </View>
          </View>
        </View>

        {/* Enter Arena — primary CTA */}
        <Pressable
          style={styles.arenaCard}
          onPress={() => router.push(`/spot/${spot.id}`)}
        >
          <View style={styles.arenaHeader}>
            <Text style={styles.seasonTag}>SEASON 01</Text>
            <View style={styles.liveDot}>
              <View style={styles.liveDotInner} />
              <Text style={styles.liveText}>{spot.activeRidersToday} LIVE</Text>
            </View>
          </View>
          <Text style={styles.arenaName}>{spot.name}</Text>
          <Text style={styles.arenaRegion}>{spot.region}</Text>
          <Text style={styles.arenaTagline}>{spotLore.tagline}</Text>

          <View style={styles.enterBtn}>
            <Text style={styles.enterBtnText}>ENTER ARENA</Text>
          </View>
        </Pressable>

        {/* Active challenge */}
        <View style={styles.challengeCard}>
          <View style={styles.challengeHeader}>
            <Text style={styles.challengeIcon}>⚡</Text>
            <Text style={styles.challengeLabel}>ACTIVE CHALLENGE</Text>
          </View>
          <Text style={styles.challengeName}>{activeChallenge.name}</Text>
          <Text style={styles.challengeDesc}>{activeChallenge.description}</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(activeChallenge.currentProgress / activeChallenge.targetProgress) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>
            {activeChallenge.currentProgress}/{activeChallenge.targetProgress}
          </Text>
        </View>

        {/* Hot trail quick-access */}
        <Pressable
          style={styles.hotTrailCard}
          onPress={() => router.push(`/trail/${hotTrail.id}`)}
        >
          <View style={styles.hotHeader}>
            <Text style={styles.hotBadge}>🔥 HOT TRAIL</Text>
          </View>
          <Text style={styles.hotTrailName}>{hotTrail.name}</Text>
          <View style={styles.hotMeta}>
            <Text style={[styles.hotDiff, { color: trailLineColors[hotTrail.difficulty] }]}>
              {hotTrail.difficulty.toUpperCase()}
            </Text>
            <Text style={styles.hotType}>{hotTrail.trailType.toUpperCase()}</Text>
            <Text style={styles.hotStats}>
              {hotTrail.distanceM}m · ↓{hotTrail.elevationDropM}m
            </Text>
          </View>
        </Pressable>

        {/* Quick trail access */}
        <Text style={styles.sectionLabel}>ALL TRAILS</Text>
        {mockTrails.map((trail) => {
          const stats = getUserTrailStats(trail.id);
          const diffColor = trailLineColors[trail.difficulty];
          return (
            <Pressable
              key={trail.id}
              style={styles.trailRow}
              onPress={() => router.push(`/trail/${trail.id}`)}
            >
              <View style={[styles.trailDot, { backgroundColor: diffColor }]} />
              <View style={styles.trailRowInfo}>
                <Text style={styles.trailRowName}>{trail.name}</Text>
                <Text style={styles.trailRowMeta}>
                  {trail.difficulty.toUpperCase()} · {trail.trailType}
                </Text>
              </View>
              <View style={styles.trailRowRight}>
                {stats?.pbMs ? (
                  <Text style={styles.trailRowPb}>{formatTimeShort(stats.pbMs)}</Text>
                ) : (
                  <Text style={styles.trailRowNoPb}>—</Text>
                )}
                {stats?.position && (
                  <Text style={styles.trailRowPos}>#{stats.position}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
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
    padding: spacing.lg,
    paddingBottom: spacing.huge,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h1,
    color: colors.textPrimary,
    letterSpacing: 6,
  },
  rankPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgCard,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankIcon: {
    fontSize: 14,
  },
  rankName: {
    ...typography.labelSmall,
    letterSpacing: 2,
  },
  xpMini: {
    width: 30,
    height: 3,
    backgroundColor: colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  xpMiniFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Arena card — primary CTA
  arenaCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  arenaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seasonTag: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 3,
  },
  liveDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  liveDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  liveText: {
    ...typography.labelSmall,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 2,
  },
  arenaName: {
    ...typography.h1,
    color: colors.textPrimary,
    fontSize: 30,
  },
  arenaRegion: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  arenaTagline: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  enterBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  enterBtnText: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 4,
    fontSize: 16,
  },

  // Challenge
  challengeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  challengeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  challengeIcon: {
    fontSize: 14,
  },
  challengeLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  challengeName: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  challengeDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: 2,
    marginTop: spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    textAlign: 'right',
    marginTop: spacing.xxs,
    fontSize: 9,
  },

  // Hot trail
  hotTrailCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.red,
  },
  hotHeader: {
    marginBottom: spacing.sm,
  },
  hotBadge: {
    ...typography.labelSmall,
    color: colors.red,
    letterSpacing: 2,
  },
  hotTrailName: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  hotMeta: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  hotDiff: {
    ...typography.labelSmall,
    letterSpacing: 1,
  },
  hotType: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },
  hotStats: {
    ...typography.labelSmall,
    color: colors.textTertiary,
  },

  // Trail list
  sectionLabel: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  trailDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  trailRowInfo: {
    flex: 1,
  },
  trailRowName: {
    ...typography.body,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
  },
  trailRowMeta: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    marginTop: 2,
  },
  trailRowRight: {
    alignItems: 'flex-end',
  },
  trailRowPb: {
    ...typography.timeSmall,
    color: colors.accent,
    fontSize: 14,
  },
  trailRowNoPb: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  trailRowPos: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    marginTop: 2,
  },
});
