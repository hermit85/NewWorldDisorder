// ═══════════════════════════════════════════════════════════
// Trail Detail — event page for a single trail
// Uses real backend data where available, honest empty states
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrail } from '@/data/mock/trails';
import { copy, formatTime, formatTimeShort } from '@/content/copy';
import { Difficulty } from '@/data/types';
import { useAuthContext } from '@/hooks/AuthContext';
import { useLeaderboard, useUserTrailStats } from '@/hooks/useBackend';
import { tapMedium } from '@/systems/haptics';

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
  const { profile } = useAuthContext();
  const trail = getTrail(id);

  // Real backend data
  const { entries: leaderboard, loading: lbLoading } = useLeaderboard(id ?? '', 'all_time', profile?.id);
  const { stats: trailStats } = useUserTrailStats(profile?.id);

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

  const myStats = trailStats.get(trail.id);
  const top5 = leaderboard.slice(0, 5);
  const myEntry = leaderboard.find((e) => e.isCurrentUser);
  const nearestRival = myEntry
    ? leaderboard.find((e) => e.currentPosition === myEntry.currentPosition - 1)
    : null;

  const diffColor = difficultyColors[trail.difficulty];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backText}>← BACK</Text>
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
              <Text style={styles.badgeText}>{trail.trailType.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.trailName}>{trail.name}</Text>
          <Text style={styles.trailDesc}>{trail.description}</Text>

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

        {/* Your PB — real data */}
        <View style={styles.pbCard}>
          <Text style={styles.label}>YOUR PB</Text>
          <Text style={styles.pbTime}>
            {myStats?.pbMs ? formatTime(myStats.pbMs) : 'No PB yet'}
          </Text>
          {myStats?.position && (
            <Text style={styles.pbPosition}>#{myStats.position}</Text>
          )}
          {!profile && (
            <Text style={styles.signInHint}>Sign in to track your PB</Text>
          )}
        </View>

        {/* Nearest rival — real data */}
        {nearestRival && myEntry && (
          <View style={styles.rivalCard}>
            <Text style={styles.label}>NEAREST RIVAL</Text>
            <View style={styles.rivalRow}>
              <Text style={styles.rivalName}>
                #{nearestRival.currentPosition} {nearestRival.username}
              </Text>
              <Text style={styles.rivalGap}>
                {formatTimeShort(nearestRival.bestDurationMs)}
              </Text>
            </View>
            <Text style={styles.rivalDelta}>
              {((myEntry.bestDurationMs - nearestRival.bestDurationMs) / 1000).toFixed(1)}s ahead of you
            </Text>
          </View>
        )}

        {/* Leaderboard — real data */}
        <View style={styles.leaderboardSection}>
          <Text style={styles.label}>TOP RIDERS</Text>

          {lbLoading && (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.lg }} />
          )}

          {!lbLoading && top5.length === 0 && (
            <View style={styles.emptyLb}>
              <Text style={styles.emptyText}>No verified runs yet.</Text>
              <Text style={styles.emptyHint}>Be the first to set a time.</Text>
            </View>
          )}

          {top5.map((entry) => (
            <View
              key={entry.userId}
              style={[styles.lbRow, entry.isCurrentUser && styles.lbRowHighlight]}
            >
              <Text style={styles.lbPosition}>#{entry.currentPosition}</Text>
              <Text style={[styles.lbName, entry.isCurrentUser && { color: colors.accent }]}>
                {entry.username}
              </Text>
              <Text style={styles.lbTime}>{formatTimeShort(entry.bestDurationMs)}</Text>
            </View>
          ))}

          {myEntry && myEntry.currentPosition > 5 && (
            <>
              <Text style={styles.lbDots}>···</Text>
              <View style={[styles.lbRow, styles.lbRowHighlight]}>
                <Text style={styles.lbPosition}>#{myEntry.currentPosition}</Text>
                <Text style={[styles.lbName, { color: colors.accent }]}>
                  {myEntry.username}
                </Text>
                <Text style={styles.lbTime}>{formatTimeShort(myEntry.bestDurationMs)}</Text>
              </View>
            </>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Start Run CTA */}
      <View style={styles.ctaContainer}>
        <Pressable
          style={styles.startBtn}
          onPress={() => {
            tapMedium();
            router.push({
              pathname: '/run/active',
              params: { trailId: trail.id, trailName: trail.name },
            });
          }}
        >
          <Text style={styles.startBtnText}>START RUN</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg },
  backBtn: { marginBottom: spacing.lg },
  backText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2 },
  header: { marginBottom: spacing.xl },
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  badge: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  badgeText: { ...typography.labelSmall, color: colors.textSecondary },
  trailName: { ...typography.h1, color: colors.textPrimary, fontSize: 32 },
  trailDesc: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg },
  stat: {},
  statValue: { ...typography.h3, color: colors.textPrimary },
  statLabel: { ...typography.labelSmall, color: colors.textTertiary },
  pbCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  label: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, marginBottom: spacing.sm },
  pbTime: { ...typography.timeLarge, color: colors.accent },
  pbPosition: { ...typography.label, color: colors.textSecondary, marginTop: spacing.xs },
  signInHint: { ...typography.labelSmall, color: colors.textTertiary, marginTop: spacing.sm },
  rivalCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  rivalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rivalName: { ...typography.h3, color: colors.textPrimary },
  rivalGap: { ...typography.timeSmall, color: colors.textSecondary },
  rivalDelta: { ...typography.bodySmall, color: colors.orange, marginTop: spacing.xs },
  leaderboardSection: { marginTop: spacing.lg },
  emptyLb: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { ...typography.body, color: colors.textSecondary },
  emptyHint: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.xs },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  lbRowHighlight: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 0 },
  lbPosition: { ...typography.label, color: colors.textTertiary, width: 40 },
  lbName: { ...typography.body, color: colors.textPrimary, flex: 1, fontFamily: 'Inter_600SemiBold' },
  lbTime: { ...typography.timeSmall, color: colors.textSecondary },
  lbDots: { ...typography.body, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xs },
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: colors.bg },
  startBtn: { backgroundColor: colors.accent, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  startBtnText: { ...typography.cta, color: colors.bg, letterSpacing: 3 },
});
