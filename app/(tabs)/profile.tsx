import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { mockAchievements } from '@/data/mock/achievements';
import { getRank, getXpToNextRank } from '@/systems/ranks';
import { copy } from '@/content/copy';
import { useAuthContext } from '@/hooks/AuthContext';
import { useProfile } from '@/hooks/useBackend';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile: authProfile, user: authUser, isAuthenticated, signOut } = useAuthContext();
  const { profile: user } = useProfile(authProfile?.id);

  const rank = user ? getRank(user.rankId) : getRank('rookie');
  const xpProgress = getXpToNextRank(user?.xp ?? 0);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Player card */}
        <View style={styles.playerCard}>
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarText}>{rank.icon}</Text>
          </View>
          <Text style={styles.username}>{user?.username ?? 'Rider'}</Text>
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
              {user?.xp ?? 0} / {xpProgress.nextRank?.xpThreshold ?? 'MAX'} XP
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatBox label={copy.totalRuns} value={String(user?.totalRuns ?? 0)} />
          <StatBox label={copy.personalBests} value={String(user?.totalPbs ?? 0)} />
          <StatBox label={copy.bestPosition} value={user?.bestPosition ? `#${user.bestPosition}` : '—'} />
        </View>

        {/* Sign in prompt */}
        {!isAuthenticated && (
          <Pressable
            style={styles.signInCard}
            onPress={() => router.push('/auth')}
          >
            <Text style={styles.signInTitle}>SIGN IN TO TRACK YOUR STATS</Text>
            <Text style={styles.signInDesc}>
              Create a rider tag, save your runs, and enter the league.
            </Text>
            <View style={styles.signInBtn}>
              <Text style={styles.signInBtnText}>ENTER THE LEAGUE</Text>
            </View>
          </Pressable>
        )}

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
              <View style={[styles.achievementBadge, a.isUnlocked && styles.achievementBadgeUnlocked]}>
                <Text style={[styles.achievementBadgeText, a.isUnlocked && { color: colors.accent }]}>
                  {a.icon}
                </Text>
              </View>
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
          <Text style={styles.appInfoText}>New World Disorder v0.2.0-beta</Text>
          <Text style={styles.appInfoText}>Season 01 · Słotwiny Arena</Text>

          {isAuthenticated && (
            <Text style={styles.appInfoText}>
              {authUser?.email ?? ''}
            </Text>
          )}

          <View style={styles.appActions}>
            <Pressable
              style={styles.actionLink}
              onPress={() => router.push('/help')}
            >
              <Text style={styles.actionLinkText}>HELP / FAQ</Text>
            </Pressable>

            <Pressable
              style={styles.actionLink}
              onPress={() => router.push('/onboarding')}
            >
              <Text style={styles.actionLinkText}>GAME RULES</Text>
            </Pressable>

            {isAuthenticated ? (
              <Pressable style={styles.actionLink} onPress={handleSignOut}>
                <Text style={[styles.actionLinkText, { color: colors.red }]}>SIGN OUT</Text>
              </Pressable>
            ) : (
              <Pressable
                style={styles.actionLink}
                onPress={() => router.push('/auth')}
              >
                <Text style={[styles.actionLinkText, { color: colors.accent }]}>SIGN IN</Text>
              </Pressable>
            )}
          </View>
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
    opacity: 0.35,
  },
  achievementBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  achievementBadgeUnlocked: {
    borderColor: colors.accent,
    backgroundColor: colors.accentDim,
  },
  achievementBadgeText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 12,
    color: colors.textTertiary,
  },
  signInCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
  },
  signInTitle: {
    ...typography.label,
    color: colors.textPrimary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  signInDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  signInBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
  },
  signInBtnText: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 3,
    fontSize: 13,
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
  appActions: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  actionLink: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
  },
  actionLinkText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
});
