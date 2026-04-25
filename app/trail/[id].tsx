// ═══════════════════════════════════════════════════════════
// Trail — pole bitwy, nie opis trasy
// Board-first: pokaż pozycję, rywala, cel
// ═══════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { useTrail, useSpot, useDeleteTrail } from '@/hooks/useBackend';
import { TrustBadge } from '@/components/game/TrustBadge';
import { PioneerBadge } from '@/components/game/PioneerBadge';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { getVenueForTrail } from '@/data/venues';
import { formatTime, formatTimeShort } from '@/content/copy';
import { Difficulty, PeriodType } from '@/data/types';
import { useAuthContext } from '@/hooks/AuthContext';
import { useLeaderboard, useUserTrailStats } from '@/hooks/useBackend';
import { tapMedium, tapLight } from '@/systems/haptics';
import { reportRider } from '@/services/moderation';

/** Polish trust-disclosure copy shown above the leaderboard.
 *  GPT Rule 2: the user must always see why we trust (or don't trust)
 *  a result before they see the ranking. Curator-seeded provisional
 *  parks get softer language than rider-seeded ones because curator
 *  status commands more initial confidence (ADR-012 Final §Philosophy). */
function getTrustDisclosure(
  source: 'curator' | 'rider',
  tier: 'provisional' | 'verified' | 'disputed',
): string {
  if (tier === 'disputed') return 'Wyniki zamrożone · weryfikacja w toku';
  if (tier === 'verified') return 'Trasa potwierdzona przez społeczność · oficjalne wyniki';
  if (source === 'curator') {
    return 'Trasa kuratora · czasy orientacyjne dopóki społeczność nie potwierdzi';
  }
  return 'Trasa próbna · czasy tymczasowe dopóki społeczność nie potwierdzi';
}

/** Polish relative date for Pioneer identity row. Keeps it short —
 *  "28 kwi 2026" — so it doesn't wrap the row on narrow devices. */
function formatPioneerDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const months = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paź','lis','gru'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

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
  const { trail } = useTrail(id ?? null);
  const { spot } = useSpot(trail?.spotId ?? null);
  const venueMatch = id ? getVenueForTrail(id) : undefined;
  const isTrainingOnly = venueMatch ? !venueMatch.venue.rankingEnabled : false;
  const spotName = spot?.name ?? venueMatch?.venue.name;
  const isCurator = profile?.role === 'curator' || profile?.role === 'moderator';
  // Pioneer self-delete eligibility mirrors the server-side gate in
  // migration 20260424120000: rider must be the trail's pioneer AND
  // the trail must still be in an in-flight state. The server also
  // checks runs_contributed <= 1; that field isn't exposed to the
  // client, so on rare boundary cases the UI offers the action but
  // the RPC returns 'unauthorized' and the alert surfaces it.
  const isPioneerSelf =
    !!profile?.id &&
    !!trail?.pioneerUserId &&
    profile.id === trail.pioneerUserId &&
    (
      trail.calibrationStatus === 'draft'
      || trail.calibrationStatus === 'fresh_pending_second_run'
      || trail.calibrationStatus === 'calibrating'
    );
  const canDeleteTrail = isCurator || isPioneerSelf;
  const { submit: deleteTrail } = useDeleteTrail();

  const [boardScope, setBoardScope] = useState<PeriodType>('all_time');
  const {
    entries: leaderboard,
    loading: lbLoading,
    status: lbStatus,
    refresh: lbRefresh,
  } = useLeaderboard(id ?? '', boardScope, profile?.id);
  const { stats: trailStats } = useUserTrailStats(profile?.id);

  const goBack = () => {
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
  };

  const goToSpot = useCallback(() => {
    if (!trail?.spotId) return;
    tapLight();
    router.push(`/spot/${trail.spotId}`);
  }, [trail?.spotId, router]);

  const handleDeleteTrail = useCallback(() => {
    if (!trail) return;
    Alert.alert(
      `Usunąć trasę ${trail.name}?`,
      'Trasa zostanie usunięta razem ze wszystkimi czasami.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteTrail(trail.id);
            if (result.ok) {
              goBack();
            } else {
              Alert.alert(
                `Nie udało się: ${result.code}`,
                result.message ?? 'Spróbuj ponownie',
              );
            }
          },
        },
      ],
    );
  }, [trail, deleteTrail]);

  if (!trail) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.textPrimary, padding: spacing.lg }}>Trasa nie znaleziona</Text>
      </SafeAreaView>
    );
  }

  // Draft trail — the only valid action is to start the pioneer
  // recording. Leaderboard is empty by definition, race CTAs are
  // meaningless until someone carves the geometry.
  if (trail.calibrationStatus === 'draft' && trail.geometryMissing) {
    const startRecording = () => {
      if (!isAuthenticated) {
        tapLight();
        router.push('/auth');
        return;
      }
      tapMedium();
      router.push(`/run/recording?trailId=${trail.id}&spotId=${trail.spotId}`);
    };
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backText}>← WRÓĆ</Text>
          </Pressable>

          {spotName && (
            <Pressable onPress={goToSpot} hitSlop={8} style={styles.breadcrumbRow}>
              <Text style={styles.breadcrumbLabel}>BIKE PARK:</Text>
              <Text style={styles.breadcrumbName}>{spotName}</Text>
              <Text style={styles.breadcrumbArrow}>→</Text>
            </Pressable>
          )}

          <View style={styles.hero}>
            <Text style={styles.trailKicker}>⟣ TRASA</Text>
            <Text style={[styles.trailName, { marginTop: spacing.xs }]}>{trail.name}</Text>
            <Text style={draftStyles.eyebrow}>● DRAFT · CZEKA NA PIONIERA</Text>
          </View>

          <Pressable
            onPress={startRecording}
            style={({ pressed }) => [
              draftStyles.cta,
              pressed && { transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={draftStyles.ctaDot}>●</Text>
            <Text style={draftStyles.ctaLabel}>ROZPOCZNIJ NAGRYWANIE</Text>
            <Text style={draftStyles.ctaSub}>
              Twój pierwszy zjazd wyznaczy linię dla wszystkich
            </Text>
          </Pressable>

          {canDeleteTrail && (
            <Pressable onPress={handleDeleteTrail} hitSlop={12} style={styles.curatorDelete}>
              <Text style={styles.curatorDeleteLabel}>Usuń tę trasę</Text>
            </Pressable>
          )}
        </ScrollView>
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

  // B29: intent is the pre-declared mode, carried as a route param.
  // `/run/active` is the only screen that mounts `useRealRun`, and the
  // hook binds its `mode` to this intent immutably — there's no in-run
  // path that can flip it. Training-only venues are gated here so the
  // ranked CTA never reaches route at all; the route guard at
  // `/run/active` still rejects a `intent=ranked` deep-link on such a
  // venue as defense-in-depth.
  const handleStartRanked = () => {
    if (isTrainingOnly) {
      tapLight();
      return;
    }
    if (!isAuthenticated) {
      tapLight();
      router.push('/auth');
      return;
    }
    tapMedium();
    router.push({
      pathname: '/run/active',
      params: { trailId: trail.id, trailName: trail.name, intent: 'ranked' },
    });
  };

  const handleStartPractice = () => {
    tapLight();
    router.push({
      pathname: '/run/active',
      params: { trailId: trail.id, trailName: trail.name, intent: 'practice' },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={goBack} style={styles.backBtn}>
          <Text style={styles.backText}>← WRÓĆ</Text>
        </Pressable>

        {/* ═══ BREADCRUMB ═══ */}
        {spotName && (
          <Pressable onPress={goToSpot} hitSlop={8} style={styles.breadcrumbRow}>
            <Text style={styles.breadcrumbLabel}>BIKE PARK:</Text>
            <Text style={styles.breadcrumbName}>{spotName}</Text>
            <Text style={styles.breadcrumbArrow}>→</Text>
          </Pressable>
        )}

        {/* ═══ TRAIL HERO ═══ */}
        <View style={styles.hero}>
          <Text style={styles.trailKicker}>⟣ TRASA</Text>
          <Text style={[styles.trailName, { marginTop: spacing.xs }]}>{trail.name}</Text>

          {/* Trust disclosure (Sprint 4 / ADR-012). Null on drafts — component renders nothing. */}
          <View style={styles.trustRow}>
            <TrustBadge seedSource={trail.seedSource} trustTier={trail.trustTier} />
          </View>

          {/* Pioneer identity row — visible only when trail has a Pioneer assigned */}
          {trail.pioneerUsername && (
            <View style={styles.pioneerRow}>
              <PioneerBadge size="sm" />
              <Text style={styles.pioneerLabel}>Pioneer:</Text>
              <Text style={styles.pioneerName}>@{trail.pioneerUsername}</Text>
              {trail.pioneeredAt && (
                <Text style={styles.pioneerDate}>· {formatPioneerDate(trail.pioneeredAt)}</Text>
              )}
            </View>
          )}

          {trail.confidenceLabel && (
            <Text style={styles.confidenceText}>
              {trail.confidenceLabel === 'stable'
                ? 'Ustabilizowana'
                : trail.confidenceLabel === 'community_checked'
                  ? 'Sprawdzona przez innych'
                  : trail.confidenceLabel === 'confirmed'
                    ? 'Potwierdzona trasa'
                    : trail.calibrationStatus === 'fresh_pending_second_run'
                      ? 'Potrzebny drugi zjazd'
                      : 'Świeża trasa'}
            </Text>
          )}

          <View style={[styles.badges, { marginTop: spacing.md }]}>
            <View style={[styles.badge, { borderColor: diffColor }]}>
              <Text style={[styles.badgeText, { color: diffColor }]}>{trail.difficulty.toUpperCase()}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{trail.trailType.toUpperCase()}</Text>
            </View>
          </View>
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

        {/* ═══ TRUST DISCLOSURE BANNER (GPT Rule 2) ═══ */}
        {trail.seedSource && trail.trustTier && (
          <View style={styles.disclosureBanner}>
            <TrustBadge
              seedSource={trail.seedSource}
              trustTier={trail.trustTier}
              size="sm"
            />
            <Text style={styles.disclosureText}>
              {getTrustDisclosure(trail.seedSource, trail.trustTier)}
            </Text>
          </View>
        )}

        {/* ═══ BOARD — top riders ═══ */}
        <View style={styles.boardSection}>
          <SectionHeader
            label="Tablica"
            glyph="▲"
            glyphColor={colors.accent}
            action={
              leaderboard.length > 5
                ? {
                    label: 'Pełna tablica',
                    onPress: () =>
                      router.push({
                        pathname: '/(tabs)/leaderboard',
                        params: { trailId: trail.id, scope: boardScope },
                      }),
                  }
                : undefined
            }
            spacingTop="none"
          />
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

          {lbLoading && <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.lg }} />}

          {!lbLoading && lbStatus === 'error' && (
            <View style={styles.errorLb}>
              <Text style={styles.emptyText}>Nie udało się załadować tablicy</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ponów ładowanie tablicy"
                onPress={() => lbRefresh()}
                style={({ pressed }) => [
                  styles.errorLbBtn,
                  pressed && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.errorLbBtnText}>PONÓW</Text>
              </Pressable>
            </View>
          )}

          {!lbLoading && lbStatus !== 'error' && top5.length === 0 && (
            <View style={styles.emptyLb}>
              <Text style={styles.emptyText}>Tablica pusta</Text>
              <Text style={styles.emptyHint}>Postaw pierwszy czas</Text>
            </View>
          )}

          {top5.map((entry) => (
            <Pressable
              key={entry.userId}
              style={[styles.lbRow, entry.isCurrentUser && styles.lbRowHighlight]}
              onLongPress={() => {
                if (entry.isCurrentUser) return;
                reportRider({
                  userId: entry.userId,
                  username: entry.username,
                  surface: `Trasa · ${trail.name}`,
                });
              }}
              delayLongPress={450}
            >
              <Text style={[styles.lbPos,
                entry.currentPosition <= 3 && { color: colors.gold },
                entry.isCurrentUser && { color: colors.accent },
              ]}>
                {entry.currentPosition}
              </Text>
              <Text style={[styles.lbName, entry.isCurrentUser && { color: colors.accent }]} numberOfLines={1}>
                {entry.username}
              </Text>
              {/* Pioneer mark stays on Pioneer's row regardless of rank position —
                  identity, not ranking. */}
              {entry.userId === trail.pioneerUserId && <PioneerBadge size="sm" />}
              <Text style={styles.lbTime}>{formatTimeShort(entry.bestDurationMs)}</Text>
            </Pressable>
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

        </View>

        {canDeleteTrail && (
          <Pressable onPress={handleDeleteTrail} hitSlop={12} style={styles.curatorDelete}>
            <Text style={styles.curatorDeleteLabel}>Usuń tę trasę</Text>
          </Pressable>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ═══ RIDE CTAs ═══
          B29: ranked button is visually disabled on training-only venues
          (TRASA nie ma jeszcze kalibracji rankingowej). Tapping it is a
          no-op so the rider can't accidentally route to ranked and hit
          the Alert-redirect guard on /run/active. */}
      <View style={styles.ctaContainer}>
        <Pressable
          style={[styles.rankedBtn, isTrainingOnly && styles.rankedBtnDisabled]}
          onPress={handleStartRanked}
          disabled={isTrainingOnly}
          accessibilityState={{ disabled: isTrainingOnly }}
        >
          <Text style={[styles.rankedBtnText, isTrainingOnly && styles.rankedBtnTextDisabled]}>
            {isTrainingOnly
              ? 'RANKING NIEDOSTĘPNY'
              : isAuthenticated
                ? 'JEDŹ RANKINGOWO'
                : 'ZALOGUJ — JEDŹ RANKINGOWO'}
          </Text>
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

  // Breadcrumb (B2 — tappable parent link)
  breadcrumbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.md,
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  breadcrumbLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    color: 'rgba(232, 255, 240, 0.45)',
  },
  breadcrumbName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: colors.accent,
    letterSpacing: 0.5,
  },
  breadcrumbArrow: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 12,
    color: colors.accent,
  },

  // Hero
  hero: { marginBottom: spacing.xl },
  trailKicker: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: colors.accent,
  },

  // Sprint 4 — trust + pioneer rows under the trail name
  trustRow: {
    marginTop: spacing.md,
    alignSelf: 'flex-start',
  },
  pioneerRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  pioneerLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 1,
    marginLeft: 2,
  },
  pioneerName: {
    fontFamily: 'Rajdhani_600SemiBold',
    color: colors.accent,
    fontSize: 13,
    letterSpacing: 1,
  },
  pioneerDate: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 10,
  },
  confidenceText: {
    ...typography.label,
    color: colors.accent,
    letterSpacing: 1.2,
    marginTop: spacing.sm,
  },
  disclosureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  disclosureText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    flex: 1,
    flexShrink: 1,
    letterSpacing: 0,
    fontSize: 11,
    lineHeight: 15,
  },
  venueLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, marginBottom: spacing.md, fontSize: 9 },
  badges: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  badge: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xxs },
  badgeText: { ...typography.labelSmall, color: colors.textSecondary },
  trailName: { fontFamily: 'Rajdhani_700Bold', fontSize: 28, color: colors.textPrimary, letterSpacing: 2 },
  venueSub: { ...typography.bodySmall, color: colors.textTertiary, marginTop: 2 },
  trainingTag: { ...typography.labelSmall, color: colors.orange, letterSpacing: 2, fontSize: 9, marginTop: spacing.sm },
  trailMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  metaText: { ...typography.body, color: colors.textSecondary },
  metaDot: { color: colors.textTertiary },

  // Board status
  statusCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  statusMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statusPos: { fontFamily: 'Rajdhani_700Bold', fontSize: 36, color: colors.accent },
  statusTier: { ...typography.labelSmall, letterSpacing: 3, marginTop: spacing.xxs, fontSize: 10 },
  statusRight: { alignItems: 'flex-end' },
  statusPbLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, fontSize: 9 },
  statusPb: { fontFamily: 'Rajdhani_700Bold', fontSize: 20, color: colors.textPrimary, marginTop: spacing.xxs },
  statusPbScope: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 2, fontSize: 8, marginTop: 2 },
  rivalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  rivalLabel: { ...typography.bodySmall, color: colors.orange, fontFamily: 'Inter_600SemiBold' },
  rivalGap: { fontFamily: 'Rajdhani_700Bold', fontSize: 14, color: colors.orange },
  ambition: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 1, marginTop: spacing.sm, textAlign: 'center' },
  noResultState: { alignItems: 'center', paddingVertical: spacing.sm },
  noResultText: { ...typography.body, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  noResultHint: { ...typography.labelSmall, color: colors.textTertiary, marginTop: spacing.xs },
  signInCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  signInText: { ...typography.body, color: colors.accent, fontFamily: 'Inter_600SemiBold' },

  // Board
  boardSection: { marginTop: spacing.sm },
  scopeTabs: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  scopeTab: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radii.sm, borderWidth: 1, borderColor: colors.border },
  scopeTabActive: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  scopeTabText: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 9, letterSpacing: 1 },
  scopeTabTextActive: { color: colors.accent },
  emptyLb: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyText: { ...typography.body, color: colors.textSecondary },
  emptyHint: { ...typography.bodySmall, color: colors.textTertiary, marginTop: spacing.xs },
  errorLb: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  errorLbBtn: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorLbBtnText: { ...typography.label, color: colors.accent, letterSpacing: 3 },
  lbRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  lbRowHighlight: { backgroundColor: colors.accentDim, borderRadius: radii.sm, paddingHorizontal: spacing.sm, borderBottomWidth: 0, marginVertical: spacing.xxs },
  lbPos: { fontFamily: 'Rajdhani_700Bold', fontSize: 16, color: colors.textTertiary, width: 36 },
  lbName: { ...typography.body, color: colors.textPrimary, flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  lbTime: { fontFamily: 'Rajdhani_700Bold', fontSize: 14, color: colors.textSecondary, letterSpacing: 1 },
  lbDots: { ...typography.body, color: colors.textTertiary, textAlign: 'center', paddingVertical: spacing.xs },

  // CTAs
  ctaContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.lg, paddingBottom: spacing.xxl, backgroundColor: colors.bg, flexDirection: 'row', gap: spacing.sm },
  rankedBtn: { flex: 2, backgroundColor: colors.accent, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  rankedBtnText: { fontFamily: 'Rajdhani_700Bold', fontSize: 14, color: colors.bg, letterSpacing: 3 },
  // B29: disabled affordance for training-only venues — muted surface
  // + ghost text so the rider reads it as "not available" rather than
  // "broken button I can mash".
  rankedBtnDisabled: { backgroundColor: colors.bgCard, opacity: 0.55 },
  rankedBtnTextDisabled: { color: colors.textTertiary },
  practiceBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  practiceBtnText: { ...typography.label, color: colors.textSecondary, letterSpacing: 2 },

  // Curator delete link (draft trails only)
  curatorDelete: {
    marginTop: spacing.xxl,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  curatorDeleteLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: 'rgba(255, 67, 101, 0.70)',
    textDecorationLine: 'underline',
    letterSpacing: 0.5,
  },
});

// ── Draft-trail pioneer CTA styles ──

const draftStyles = StyleSheet.create({
  eyebrow: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
    letterSpacing: 3,
    color: colors.accent,
    marginTop: spacing.md,
  },
  cta: {
    marginTop: spacing.xxl,
    marginHorizontal: spacing.lg,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.xl,
    backgroundColor: 'rgba(20, 35, 26, 0.95)',
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  ctaDot: {
    color: '#FF4365',
    fontSize: 18,
    marginBottom: spacing.sm,
  },
  ctaLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 20,
    letterSpacing: 4,
    color: colors.accent,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  ctaSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: 'rgba(232, 255, 240, 0.55)',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
