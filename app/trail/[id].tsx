// ═══════════════════════════════════════════════════════════
// Trail — pole bitwy, nie opis trasy
// Board-first: pokaż pozycję, rywala, cel
// ═══════════════════════════════════════════════════════════

import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrail } from '@/data/mock/trails';
import { getVenueForTrail } from '@/data/venues';
import { formatTime, formatTimeShort } from '@/content/copy';
import { Difficulty, PeriodType } from '@/data/types';
import { useAuthContext } from '@/hooks/AuthContext';
import { useLeaderboard, useUserTrailStats } from '@/hooks/useBackend';
import { tapMedium, tapLight } from '@/systems/haptics';

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
  const { profile, isAuthenticated } = useAuthContext();
  const trail = getTrail(id);
  const venueMatch = id ? getVenueForTrail(id) : undefined;
  const venueName = venueMatch?.venue.name;
  const isTrainingOnly = venueMatch ? !venueMatch.venue.rankingEnabled : false;

  const [boardScope, setBoardScope] = useState<PeriodType>('all_time');
  const { entries: leaderboard, loading: lbLoading } = useLeaderboard(id ?? '', boardScope, profile?.id);
  const { stats: trailStats } = useUserTrailStats(profile?.id);

  const goBack = () => {
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
  };

  if (!trail) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.textPrimary, padding: spacing.lg }}>Trasa nie znaleziona</Text>
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
  const myPos = myEntry?.currentPosition ?? 0;
  const tierLabel = myPos > 0 && myPos <= 3 ? 'PODIUM'
    : myPos > 0 && myPos <= 10 ? 'TOP 10'
    : null;
  const placesToNextTier = myPos === 0 ? 0
    : myPos <= 3 ? 0
    : myPos <= 10 ? myPos - 3
    : myPos - 10;

  const handleStartRanked = () => {
    tapMedium();
    router.push({ pathname: '/run/active', params: { trailId: trail.id, trailName: trail.name } });
  };

  const handleStartPractice = () => {
    tapLight();
    router.push({ pathname: '/run/active', params: { trailId: trail.id, trailName: trail.name } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backText}>← WRÓĆ</Text>
        </Pressable>

        {/* ═══ TRAIL HERO ═══ */}
        <View style={styles.hero}>
          <Text style={styles.venueLabel}>{(venueName ?? 'ARENA').toUpperCase()}</Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { borderColor: diffColor }]}>
              <Text style={[styles.badgeText, { color: diffColor }]}>{trail.difficulty.toUpperCase()}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{trail.trailType.toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.trailName}>{trail.name}</Text>
          {venueName && <Text style={styles.venueSub}>{venueName}</Text>}
          {isTrainingOnly && <Text style={styles.trainingTag}>WALIDACJA TRENINGOWA</Text>}
          <View style={styles.trailMeta}>
            <Text style={styles.metaText}>{trail.distanceM}m</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>↓{trail.elevationDropM}m</Text>
          </View>
        </View>

        {/* ═══ BOARD STATUS — where you stand ═══ */}
        {isAuthenticated ? (
          <View style={[styles.statusCard, myEntry && { borderColor: colors.accent }]}>
            {myEntry ? (
              <>
                <View style={styles.statusMain}>
                  <View>
                    <Text style={styles.statusPos}>#{myPos}</Text>
                    <Text style={[styles.statusTier, { color: colors.textTertiary }]}>
                      {boardScope === 'day' ? 'POZYCJA · DZIŚ' : boardScope === 'weekend' ? 'POZYCJA · WEEKEND' : 'POZYCJA · WSZECHCZASÓW'}
                    </Text>
                    {tierLabel && (
                      <Text style={[styles.statusTier,
                        tierLabel === 'PODIUM' && { color: colors.gold },
                        tierLabel === 'TOP 10' && { color: colors.accent },
                      ]}>{tierLabel}</Text>
                    )}
                  </View>
                  <View style={styles.statusRight}>
                    <Text style={styles.statusPbLabel}>TWÓJ REKORD</Text>
                    <Text style={styles.statusPb}>{myStats?.pbMs ? formatTime(myStats.pbMs) : '—'}</Text>
                    <Text style={styles.statusPbScope}>WSZECHCZASÓW</Text>
                  </View>
                </View>
                {nearestRival && (
                  <View style={styles.rivalRow}>
                    <Text style={styles.rivalLabel}>CEL: #{nearestRival.currentPosition} {nearestRival.username}</Text>
                    <Text style={styles.rivalGap}>
                      {((myEntry.bestDurationMs - nearestRival.bestDurationMs) / 1000).toFixed(1)}s
                    </Text>
                  </View>
                )}
                {placesToNextTier > 0 && placesToNextTier <= 7 && (
                  <Text style={styles.ambition}>
                    {placesToNextTier === 1 ? '1 pozycja' : `${placesToNextTier} pozycji`} do {myPos > 10 ? 'TOP 10' : 'podium'}
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.noResultState}>
                <Text style={styles.noResultText}>Bez wyniku na tej trasie</Text>
                <Text style={styles.noResultHint}>Ukończ zjazd aby pojawić się na tablicy</Text>
              </View>
            )}
          </View>
        ) : (
          <Pressable style={styles.signInCard} onPress={() => router.push('/auth')}>
            <Text style={styles.signInText}>Zaloguj się aby jechać rankingowo</Text>
          </Pressable>
        )}

        {/* ═══ BOARD — top riders ═══ */}
        <View style={styles.boardSection}>
          <View style={styles.boardHeader}>
            <Text style={styles.sectionLabel}>TABLICA</Text>
            <View style={styles.scopeTabs}>
              {([['day', 'DZIŚ'], ['weekend', 'WEEKEND'], ['all_time', 'SEZON']] as [PeriodType, string][]).map(([key, label]) => (
                <Pressable
                  key={key}
                  style={[styles.scopeTab, boardScope === key && styles.scopeTabActive]}
                  onPress={() => setBoardScope(key)}
                >
                  <Text style={[styles.scopeTabText, boardScope === key && styles.scopeTabTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {lbLoading && <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.lg }} />}

          {!lbLoading && top5.length === 0 && (
            <View style={styles.emptyLb}>
              <Text style={styles.emptyText}>Tablica pusta</Text>
              <Text style={styles.emptyHint}>Postaw pierwszy czas</Text>
            </View>
          )}

          {top5.map((entry) => (
            <View key={entry.userId} style={[styles.lbRow, entry.isCurrentUser && styles.lbRowHighlight]}>
              <Text style={[styles.lbPos,
                entry.currentPosition <= 3 && { color: colors.gold },
                entry.isCurrentUser && { color: colors.accent },
              ]}>
                {entry.currentPosition}
              </Text>
              <Text style={[styles.lbName, entry.isCurrentUser && { color: colors.accent }]} numberOfLines={1}>
                {entry.username}
              </Text>
              <Text style={styles.lbTime}>{formatTimeShort(entry.bestDurationMs)}</Text>
            </View>
          ))}

          {myEntry && myEntry.currentPosition > 5 && (
            <>
              <Text style={styles.lbDots}>···</Text>
              <View style={[styles.lbRow, styles.lbRowHighlight]}>
                <Text style={[styles.lbPos, { color: colors.accent }]}>
                  {myEntry.currentPosition}
                </Text>
                <Text style={[styles.lbName, { color: colors.accent }]}>{myEntry.username}</Text>
                <Text style={styles.lbTime}>{formatTimeShort(myEntry.bestDurationMs)}</Text>
              </View>
            </>
          )}

          {leaderboard.length > 5 && (
            <Pressable style={styles.fullBoardBtn} onPress={() => router.push({
              pathname: '/(tabs)/leaderboard',
              params: { trailId: trail.id, scope: boardScope },
            })}>
              <Text style={styles.fullBoardText}>PEŁNA TABLICA →</Text>
            </Pressable>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ═══ RIDE CTAs ═══ */}
      <View style={styles.ctaContainer}>
        <Pressable style={styles.rankedBtn} onPress={handleStartRanked}>
          <Text style={styles.rankedBtnText}>JEDŹ RANKINGOWO</Text>
        </Pressable>
        <Pressable style={styles.practiceBtn} onPress={handleStartPractice}>
          <Text style={styles.practiceBtnText}>TRENING</Text>
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

  // Hero
  hero: { marginBottom: spacing.xl },
  venueLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, marginBottom: spacing.md, fontSize: 9 },
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  badge: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  badgeText: { ...typography.labelSmall, color: colors.textSecondary },
  trailName: { fontFamily: 'Orbitron_700Bold', fontSize: 28, color: colors.textPrimary, letterSpacing: 2 },
  venueSub: { ...typography.bodySmall, color: colors.textTertiary, marginTop: 2 },
  trainingTag: { ...typography.labelSmall, color: colors.orange, letterSpacing: 2, fontSize: 9, marginTop: spacing.sm },
  trailMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  metaText: { ...typography.body, color: colors.textSecondary },
  metaDot: { color: colors.textTertiary },

  // Board status
  statusCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statusMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusPos: { fontFamily: 'Orbitron_700Bold', fontSize: 36, color: colors.accent },
  statusTier: { ...typography.labelSmall, letterSpacing: 3, marginTop: spacing.xxs, fontSize: 10 },
  statusRight: { alignItems: 'flex-end' },
  statusPbLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, fontSize: 9 },
  statusPb: { fontFamily: 'Orbitron_700Bold', fontSize: 20, color: colors.textPrimary, marginTop: spacing.xxs },
  statusPbScope: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, fontSize: 8, marginTop: 2 },
  rivalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  rivalLabel: { ...typography.bodySmall, color: colors.orange, fontFamily: 'Inter_600SemiBold' },
  rivalGap: { fontFamily: 'Orbitron_700Bold', fontSize: 14, color: colors.orange },
  ambition: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 1, marginTop: spacing.sm, textAlign: 'center' },
  noResultState: { alignItems: 'center', paddingVertical: spacing.sm },
  noResultText: { ...typography.body, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  noResultHint: { ...typography.labelSmall, color: colors.textTertiary, marginTop: spacing.xs },
  signInCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  signInText: { ...typography.body, color: colors.accent, fontFamily: 'Inter_600SemiBold' },

  // Board
  boardSection: { marginTop: spacing.sm },
  boardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, fontSize: 9 },
  scopeTabs: { flexDirection: 'row', gap: spacing.xs },
  scopeTab: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  scopeTabActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  scopeTabText: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 9, letterSpacing: 1 },
  scopeTabTextActive: { color: colors.accent },
  emptyLb: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { ...typography.body, color: colors.textSecondary },
  emptyHint: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.xs },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  lbRowHighlight: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 0, marginVertical: spacing.xxs },
  lbPos: { fontFamily: 'Orbitron_700Bold', fontSize: 16, color: colors.textTertiary, width: 36 },
  lbName: { ...typography.body, color: colors.textPrimary, flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  lbTime: { fontFamily: 'Orbitron_700Bold', fontSize: 14, color: colors.textSecondary, letterSpacing: 1 },
  lbDots: { ...typography.body, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xs },
  fullBoardBtn: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  fullBoardText: { ...typography.labelSmall, color: colors.accent, letterSpacing: 3 },

  // CTAs
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: colors.bg, flexDirection: 'row', gap: spacing.sm },
  rankedBtn: { flex: 2, backgroundColor: colors.accent, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  rankedBtnText: { fontFamily: 'Orbitron_700Bold', fontSize: 14, color: colors.bg, letterSpacing: 3 },
  practiceBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  practiceBtnText: { ...typography.label, color: colors.textSecondary, letterSpacing: 2 },
});
