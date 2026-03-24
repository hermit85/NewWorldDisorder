import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { mockUser } from '@/data/mock/user';
import { mockAchievements } from '@/data/mock/achievements';
import { getRank, getXpToNextRank } from '@/systems/ranks';
import { copy } from '@/content/copy';

export default function ProfileScreen() {
  const router = useRouter();
  const user = mockUser;
  const rank = getRank(user.rankId);
  const xpProgress = getXpToNextRank(user.xp);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Player card */}
        <View style={styles.playerCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{rank.icon}</Text>
          </View>
          <Text style={styles.username}>{user.username}</Text>
          <Text style={[styles.rankTitle, { color: rank.color }]}>
            {rank.name}
          </Text>

          {/* XP bar */}
          <View style={styles.xpSection}>
            <View style={styles.xpBarBg}>
              <View
                style={[
                  styles.xpBarFill,
                  { width: `${xpProgress.progress * 100}%`, backgroundColor: rank.color },
                ]}
              />
            </View>
            <Text style={styles.xpText}>
              {user.xp} / {xpProgress.nextRank?.xpThreshold ?? 'MAX'} XP
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label={copy.totalRuns} value={String(user.totalRuns)} />
          <StatBox label={copy.personalBests} value={String(user.totalPbs)} />
          <StatBox label={copy.bestPosition} value={`#${user.bestPosition}`} />
        </View>

        {/* Achievements */}
        <Text style={styles.sectionTitle}>ACHIEVEMENTS</Text>
        <View style={styles.achievementGrid}>
          {mockAchievements.map((a) => (
            <View
              key={a.id}
              style={[
                styles.achievementItem,
                !a.isUnlocked && styles.achievementLocked,
              ]}
            >
              <Text style={styles.achievementIcon}>{a.icon}</Text>
              <Text
                style={[
                  styles.achievementName,
                  !a.isUnlocked && { color: colors.textTertiary },
                ]}
              >
                {a.name}
              </Text>
            </View>
          ))}
        </View>

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>New World Disorder v0.1.0-beta</Text>
          <Text style={styles.appInfoText}>Season 01 · Słotwiny Arena</Text>
          <Pressable
            style={styles.onboardingLink}
            onPress={() => router.push('/onboarding')}
          >
            <Text style={styles.onboardingLinkText}>VIEW GAME RULES</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
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
  playerCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 32,
  },
  username: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  rankTitle: {
    ...typography.label,
    marginTop: spacing.xs,
  },
  xpSection: {
    width: '100%',
    marginTop: spacing.xl,
  },
  xpBarBg: {
    height: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xxl,
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  statValue: {
    ...typography.timeMedium,
    color: colors.textPrimary,
  },
  statLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginTop: spacing.xxs,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  achievementItem: {
    width: '47%',
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  achievementLocked: {
    opacity: 0.4,
  },
  achievementIcon: {
    fontSize: 28,
    marginBottom: spacing.xs,
  },
  achievementName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
  },
  appInfo: {
    alignItems: 'center',
    paddingTop: spacing.xxl,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.xxl,
    gap: spacing.xxs,
  },
  appInfoText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 10,
    letterSpacing: 1,
  },
  onboardingLink: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  onboardingLinkText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
});
