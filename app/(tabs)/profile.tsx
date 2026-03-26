import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getRank, getXpToNextRank } from '@/systems/ranks';
import { getLevel, getLevelProgress } from '@/systems/xp';
import { copy } from '@/content/copy';
import { useAuthContext } from '@/hooks/AuthContext';
import { useProfile, useAchievements } from '@/hooks/useBackend';
import { RiderAvatar } from '@/components/RiderAvatar';
import { pickAvatarImage, uploadAvatar, removeAvatar } from '@/services/avatar';
import { triggerRefresh } from '@/hooks/useRefresh';
import { tapLight, tapMedium, notifySuccess, notifyWarning } from '@/systems/haptics';

export default function ProfileScreen() {
  const router = useRouter();
  const { profile: authProfile, user: authUser, isAuthenticated, signOut } = useAuthContext();
  const { profile: user, status: profileStatus } = useProfile(authProfile?.id);
  const { achievements, status: achStatus } = useAchievements(authProfile?.id);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const rank = user ? getRank(user.rankId) : getRank('rookie');
  const xpProgress = getXpToNextRank(user?.xp ?? 0);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/auth');
  };

  const handleAvatarPress = async () => {
    if (!authProfile?.id) return;
    tapLight();

    // If user already has avatar, show options
    if (user?.avatarUrl) {
      Alert.alert(
        'Zdjęcie profilowe',
        undefined,
        [
          { text: 'Zmień zdjęcie', onPress: () => handlePickAndUpload() },
          { text: 'Usuń zdjęcie', style: 'destructive', onPress: () => handleRemoveAvatar() },
          { text: 'Anuluj', style: 'cancel' },
        ],
      );
      return;
    }

    // No avatar — go straight to picker
    handlePickAndUpload();
  };

  const handlePickAndUpload = async () => {
    if (!authProfile?.id) return;

    const pickResult = await pickAvatarImage();

    if ('denied' in pickResult) {
      Alert.alert('Brak dostępu', 'Włącz dostęp do galerii w Ustawieniach telefonu.');
      return;
    }
    if ('cancelled' in pickResult) return;
    if ('error' in pickResult) {
      notifyWarning();
      Alert.alert('Błąd', pickResult.error);
      return;
    }

    setAvatarLoading(true);
    const result = await uploadAvatar(authProfile.id, pickResult.uri);
    setAvatarLoading(false);

    if (result.status === 'success') {
      tapMedium();
      notifySuccess();
      triggerRefresh(); // Re-fetch profile to update avatarUrl
    } else if (result.status === 'error') {
      notifyWarning();
      Alert.alert('Nie udało się', result.message);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!authProfile?.id) return;
    setAvatarLoading(true);
    const ok = await removeAvatar(authProfile.id);
    setAvatarLoading(false);

    if (ok) {
      tapLight();
      triggerRefresh();
    } else {
      notifyWarning();
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Sign in prompt */}
        {!isAuthenticated ? (
          <Pressable style={styles.signInCard} onPress={() => router.push('/auth')}>
            <Text style={styles.signInTitle}>ZALOGUJ SIĘ</Text>
            <Text style={styles.signInDesc}>
              Stwórz rider tag, zapisuj zjazdy i dołącz do ligi.
            </Text>
            <View style={styles.signInBtn}>
              <Text style={styles.signInBtnText}>DOŁĄCZ DO LIGI</Text>
            </View>
          </Pressable>
        ) : (
          <>
            {/* Player card */}
            <View style={styles.playerCard}>
              {/* Avatar — tappable */}
              <Pressable onPress={handleAvatarPress} style={styles.avatarWrap}>
                {avatarLoading ? (
                  <View style={[styles.avatarContainer, { borderColor: rank.color }]}>
                    <ActivityIndicator size="small" color={colors.accent} />
                  </View>
                ) : (
                  <RiderAvatar
                    avatarUrl={user?.avatarUrl}
                    username={user?.username ?? 'R'}
                    size={88}
                    borderColor={rank.color}
                  />
                )}
                <View style={styles.avatarEditBadge}>
                  <Text style={styles.avatarEditIcon}>
                    {user?.avatarUrl ? '✎' : '+'}
                  </Text>
                </View>
              </Pressable>

              <Text style={styles.username}>{user?.username ?? 'Rider'}</Text>

              {/* Level + Rank */}
              <View style={styles.levelRow}>
                <View style={styles.levelBadge}>
                  <Text style={styles.levelNumber}>{getLevel(user?.xp ?? 0)}</Text>
                </View>
                <Text style={[styles.rankTitle, { color: rank.color }]}>
                  {rank.name}
                </Text>
              </View>

              {/* XP bar — shows progress to next level */}
              {(() => {
                const lp = getLevelProgress(user?.xp ?? 0);
                return (
                  <View style={styles.xpSection}>
                    <View style={styles.xpBarBg}>
                      <View
                        style={[
                          styles.xpBarFill,
                          { width: `${lp.progress * 100}%`, backgroundColor: colors.accent },
                        ]}
                      />
                    </View>
                    <Text style={styles.xpText}>
                      LVL {lp.level} · {lp.currentXp}/{lp.nextLevelXp} XP
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Stats */}
            <View style={styles.statsRow}>
              <StatBox label={copy.totalRuns} value={profileStatus === 'ok' ? String(user?.totalRuns ?? 0) : '—'} />
              <StatBox label={copy.personalBests} value={profileStatus === 'ok' ? String(user?.totalPbs ?? 0) : '—'} />
              <StatBox label={copy.bestPosition} value={profileStatus === 'ok' && user?.bestPosition ? `#${user.bestPosition}` : '—'} />
            </View>

            {/* Achievements */}
            {achievements.length > 0 && (
              <>
                <Text style={styles.sectionTitle}>OSIĄGNIĘCIA</Text>
                <View style={styles.achievementGrid}>
                  {achievements.map((a) => (
                    <View key={a.id} style={styles.achievementItem}>
                      <View style={[styles.achievementBadge, styles.achievementBadgeUnlocked]}>
                        <Text style={[styles.achievementBadgeText, { color: colors.accent }]}>
                          {a.icon}
                        </Text>
                      </View>
                      <Text style={styles.achievementName}>{a.name}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        {/* App info */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>New World Disorder v0.2.0-beta</Text>
          <Text style={styles.appInfoText}>Sezon 01 · Słotwiny Arena</Text>
          {isAuthenticated && (
            <Text style={styles.appInfoText}>{authUser?.email ?? ''}</Text>
          )}
          <View style={styles.appActions}>
            <Pressable style={styles.actionLink} onPress={() => router.push('/help')}>
              <Text style={styles.actionLinkText}>POMOC</Text>
            </Pressable>
            <Pressable style={styles.actionLink} onPress={() => router.push('/onboarding')}>
              <Text style={styles.actionLinkText}>ZASADY</Text>
            </Pressable>
            {isAuthenticated ? (
              <Pressable style={styles.actionLink} onPress={handleSignOut}>
                <Text style={[styles.actionLinkText, { color: colors.red }]}>WYLOGUJ</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.actionLink} onPress={() => router.push('/auth')}>
                <Text style={[styles.actionLinkText, { color: colors.accent }]}>ZALOGUJ</Text>
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
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },
  playerCard: { alignItems: 'center', paddingVertical: spacing.xxl },

  // Avatar
  avatarWrap: { position: 'relative', marginBottom: spacing.md },
  avatarContainer: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: colors.bgCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.border,
  },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.bgElevated,
    borderWidth: 1.5, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarEditIcon: {
    fontSize: 13, color: colors.textSecondary, fontFamily: 'Inter_700Bold',
  },

  username: { ...typography.h1, color: colors.textPrimary },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  levelBadge: {
    backgroundColor: colors.accent, borderRadius: radii.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2, minWidth: 28, alignItems: 'center',
  },
  levelNumber: { fontFamily: 'Orbitron_700Bold', fontSize: 12, color: colors.bg, letterSpacing: 0 },
  rankTitle: { ...typography.label },
  xpSection: { width: '100%', marginTop: spacing.xl },
  xpBarBg: { height: 6, backgroundColor: colors.bgElevated, borderRadius: 3, overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: 3 },
  xpText: { ...typography.labelSmall, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xs },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl },
  statBox: { flex: 1, backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  statValue: { ...typography.timeMedium, color: colors.textPrimary },
  statLabel: { ...typography.labelSmall, color: colors.textTertiary, marginTop: spacing.xxs },
  sectionTitle: { ...typography.label, color: colors.textSecondary, marginBottom: spacing.md },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achievementItem: { width: '47%', backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  achievementBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  achievementBadgeUnlocked: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  achievementBadgeText: { fontFamily: 'Orbitron_700Bold', fontSize: 12, color: colors.textTertiary },
  achievementName: { ...typography.bodySmall, color: colors.textPrimary, textAlign: 'center', fontFamily: 'Inter_600SemiBold' },
  signInCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.xl, marginBottom: spacing.xxl, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  signInTitle: { ...typography.label, color: colors.textPrimary, letterSpacing: 2, marginBottom: spacing.sm },
  signInDesc: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  signInBtn: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl },
  signInBtnText: { ...typography.cta, color: colors.bg, letterSpacing: 3, fontSize: 13 },
  appInfo: { alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xxl, gap: spacing.xxs },
  appInfoText: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 10, letterSpacing: 1 },
  appActions: { flexDirection: 'row', gap: spacing.lg, marginTop: spacing.lg },
  actionLink: { paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  actionLinkText: { ...typography.labelSmall, color: colors.textSecondary, letterSpacing: 2 },
});
