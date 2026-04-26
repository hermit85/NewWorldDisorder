import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Linking, RefreshControl, Share } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { LEGAL } from '@/constants/legal';
import { getRank, getXpToNextRank } from '@/systems/ranks';
import { getLevel, getLevelProgress } from '@/systems/xp';
import { copy } from '@/content/copy';
import { useAuthContext } from '@/hooks/AuthContext';
import { useProfile, useAchievements } from '@/hooks/useBackend';
import { RiderAvatar } from '@/components/RiderAvatar';
import { ActivityList } from '@/components/profile/ActivityList';
import { SyncOutboxCard } from '@/components/sync/SyncOutboxCard';
import {
  ActivitySparkline,
  AmbientScan,
  Btn,
  Card,
  IconGlyph,
  type IconName,
  RiderIdCard,
  SectionHead,
  StatBox as NwdStatBox,
} from '@/components/nwd';
import { pickAvatarImage, uploadAvatar, removeAvatar } from '@/services/avatar';
import { triggerRefresh } from '@/hooks/useRefresh';
import { tapLight, tapMedium, notifySuccess, notifyWarning } from '@/systems/haptics';
import { fetchUserRuns } from '@/lib/api';
import { purgeOrphanedRuns } from '@/systems/runStore';

// All achievements in the game. `progressTarget` + `progressField`
// power the numeric "3/20" chip rendered on locked rows whose unlock
// condition can be read directly off the profile row. Icons map to
// the canonical 12-glyph IconGlyph set (§ 13.5 forbids decorative
// Unicode glyphs in UI). The mapping favours semantic fit over
// novelty — "first verified zjazd" → verified, "each trail in
// park" → spot, etc.
type AchievementDef = {
  slug: string;
  name: string;
  icon: IconName;
  description: string;
  /** Optional progress key — read off the `User` profile row for the
   *  numeric "N/target" chip. Omit for achievements whose progress is
   *  not a single scalar on the profile (e.g. "each trail in a park"). */
  progressField?: 'totalRuns' | 'totalPbs';
  progressTarget?: number;
};

const ACHIEVEMENT_CATALOG: readonly AchievementDef[] = [
  { slug: 'first-blood', name: 'First Blood', icon: 'verified', description: 'Pierwszy zweryfikowany zjazd', progressField: 'totalRuns', progressTarget: 1 },
  { slug: 'top-10-entry', name: 'Top 10', icon: 'podium', description: 'Wejdź do TOP 10 na dowolnej trasie' },
  { slug: 'weekend-warrior', name: 'Weekend Warrior', icon: 'flag', description: '3 zjazdy w jeden weekend' },
  { slug: 'double-pb', name: 'Double PB', icon: 'rec', description: 'Dwa rekordy w jeden dzień', progressField: 'totalPbs', progressTarget: 2 },
  { slug: 'trail-hunter', name: 'Trail Hunter', icon: 'spot', description: 'Zjedź każdą trasę w bike parku' },
  { slug: 'slotwiny-local', name: 'Local Hero', icon: 'bike', description: '20 zjazdów łącznie', progressField: 'totalRuns', progressTarget: 20 },
  { slug: 'gravity-addict', name: 'Gravity Addict', icon: 'line', description: '50 zjazdów łącznie', progressField: 'totalRuns', progressTarget: 50 },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { profile: authProfile, user: authUser, isAuthenticated, signOut } = useAuthContext();
  const { profile: user, status: profileStatus } = useProfile(authProfile?.id);
  const { achievements } = useAchievements(authProfile?.id);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const rank = user ? getRank(user.rankId) : getRank('rookie');

  // Pull-to-refresh (handoff Track C-F + polish fix 1). Fires
  // triggerRefresh so every hook subscribed via useRefreshSignal
  // re-reads the backend. Additionally reconciles the local
  // FinalizedRun store against the DB: anything the backend no
  // longer knows about (e.g. delete_spot_cascade removed parent)
  // gets purged locally so Aktywność doesn't show zombie rows.
  //
  // Safety: only purge when the DB fetch *succeeded*. An empty
  // array returned after a network failure would wipe the user's
  // history, so we skip the purge when userId is missing or when
  // fetchUserRuns throws.
  const userId = authProfile?.id ?? null;
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      triggerRefresh();
      if (userId) {
        try {
          const dbRuns = await fetchUserRuns(userId, 100);
          const liveIds = new Set(dbRuns.map((r) => r.id));
          purgeOrphanedRuns(liveIds);
        } catch (err) {
          // Leave cache intact on failure — we cannot distinguish
          // "user legitimately has zero runs" from "network error"
          // without a successful response, so we err on the side
          // of keeping the user's locally-visible history.
          console.warn('[NWD] handleRefresh: DB sync skipped —', err);
        }
      }
      // Small delay so the spinner is visible even on fast reloads.
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      setRefreshing(false);
    }
  }, [userId]);

  const handleInviteRival = useCallback(async () => {
    tapLight();
    const url = ExpoLinking.createURL('/');
    await Share.share({
      message: `Wbijaj do NWD i spróbuj mnie wyprzedzić. ${url}`,
    }).catch(() => undefined);
  }, []);

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
      <AmbientScan />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />
        }
      >
        {/* Sign in prompt — canonical Card + Btn primary.
            Handoff reference keeps this as a framed league entry card:
            centered copy, accent edge/glow, and an inset primary CTA. */}
        {!isAuthenticated ? (
          <Card hi glow padding={24} style={styles.signInCard}>
            <Text style={styles.anonTitle}>Zaloguj się</Text>
            <Text style={styles.anonBody}>
              Stwórz rider tag, zapisuj zjazdy i dołącz do ligi.
            </Text>
            <Btn
              variant="primary"
              size="lg"
              fullWidth={false}
              style={styles.signInCta}
              onPress={() => router.push('/auth')}
            >
              Dołącz do ligi
            </Btn>
          </Card>
        ) : (
          <>
            {/* Sprint 5 — RIDER ID CARD hero. The rider's passport
                replaces the inline "avatar + name + level" stack with
                a single composed primitive: breathing accent ring,
                Rajdhani 40px tag, rank+level row, optional meta line.
                Avatar is passed as a node so the upload/edit Pressable
                stays interactive (single-source identity flow). */}
            <RiderIdCard
              avatar={
                <Pressable onPress={handleAvatarPress} style={styles.avatarWrap}>
                  {avatarLoading ? (
                    <View style={[styles.avatarContainer, { borderColor: rank.color }]}>
                      <ActivityIndicator size="small" color={colors.accent} />
                    </View>
                  ) : (
                    <RiderAvatar
                      avatarUrl={user?.avatarUrl}
                      username={user?.username ?? 'R'}
                      size={96}
                      borderColor={rank.color}
                    />
                  )}
                  <View style={styles.avatarEditBadge}>
                    <Text style={styles.avatarEditIcon}>
                      {user?.avatarUrl ? '✎' : '+'}
                    </Text>
                  </View>
                </Pressable>
              }
              riderTag={user?.username ?? 'rider'}
              rankLabel={rank.name}
              level={getLevel(user?.xp ?? 0)}
              meta={`Sezon 01 · Beta · ${user?.totalRuns ?? 0} zjazdów`}
              ringColor={rank.color}
            />

            <View style={styles.playerCard}>
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

              {/* Rank progress bar — shows progress to next rank */}
              {(() => {
                const rp = getXpToNextRank(user?.xp ?? 0);
                if (!rp.nextRank) return null; // max rank reached
                return (
                  <View style={styles.rankProgressSection}>
                    <View style={styles.xpBarBg}>
                      <View
                        style={[
                          styles.xpBarFill,
                          { width: `${rp.progress * 100}%`, backgroundColor: rank.color },
                        ]}
                      />
                    </View>
                    <Text style={styles.rankProgressText}>
                      <Text style={{ color: rank.color }}>{rank.icon} {rank.name}</Text>
                      {'  →  '}
                      <Text style={{ color: rp.nextRank.color }}>{rp.nextRank.icon} {rp.nextRank.name}</Text>
                      {'  ·  '}
                      {rp.xpNeeded} XP
                    </Text>
                  </View>
                );
              })()}
            </View>

            {/* Stats — canonical 3-col StatBox grid. */}
            <View style={{ marginTop: spacing.xl }}>
              <SectionHead icon="podium" label="Statystyki" />
            </View>
            <View style={styles.statsRow}>
              <NwdStatBox
                label={copy.totalRuns}
                value={profileStatus === 'ok' ? user?.totalRuns ?? 0 : '—'}
                style={{ flex: 1 }}
              />
              <NwdStatBox
                label={copy.personalBests}
                value={profileStatus === 'ok' ? user?.totalPbs ?? 0 : '—'}
                accent={!!user?.totalPbs}
                style={{ flex: 1 }}
              />
              <NwdStatBox
                label={copy.bestPosition}
                value={profileStatus === 'ok' && user?.bestPosition ? `#${user.bestPosition}` : '—'}
                style={{ flex: 1 }}
              />
            </View>

            <SyncOutboxCard />

            {/* AKTYWNOŚĆ · 30 DNI — sparkline preview above the
                run history list. Counts per-day for the last 30
                days; today's bar pulses if rider rode today. The
                bucketing source is a soft mock for now (totalRuns
                spread back in time with a simple weighted decay)
                until the run-history endpoint exposes daily
                aggregates. The pattern teaches the viewer to read
                the chart shape; real data backfills in place. */}
            <View style={{ marginTop: spacing.xl }}>
              <ActivitySparkline
                counts={(() => {
                  const total = user?.totalRuns ?? 0;
                  if (total === 0) return new Array(30).fill(0);
                  // Weighted-decay distribution: more activity nearer
                  // today than 30 days ago. Stable per total so the
                  // chart doesn't flicker on every render.
                  const seed = total;
                  return Array.from({ length: 30 }, (_, i) => {
                    const weight = (i + 1) / 30;
                    const noise = ((seed * (i + 7)) % 5) / 5;
                    const c = Math.round(weight * 2 * (0.4 + noise));
                    return Math.max(0, c);
                  });
                })()}
                totalLabel={`${user?.totalRuns ?? 0} ZJAZDÓW · 30 DNI`}
              />
            </View>

            {/* Aktywność — handoff A6 moved run history here from the old ZJAZDY tab */}
            <View style={{ marginTop: spacing.xl }}>
              <SectionHead icon="timer" label="Historia" />
            </View>
            <ActivityList />

            {/* Achievements — full catalog with locked/unlocked states */}
            <View style={{ marginTop: spacing.xl }}>
              <SectionHead
                label="Osiągnięcia"
                count={`${achievements.length}/${ACHIEVEMENT_CATALOG.length}`}
              />
            </View>
            <View style={styles.achievementGrid}>
              {ACHIEVEMENT_CATALOG.map((def) => {
                const unlocked = achievements.find((a) => a.slug === def.slug);
                // Progress chip for locked items whose target is a simple
                // scalar on the profile (totalRuns / totalPbs). Clamped
                // to [0, target] so a legacy count beyond the goal still
                // renders sanely on the way to unlock propagation.
                const currentProgress = !unlocked && def.progressField && def.progressTarget
                  ? Math.min(user?.[def.progressField] ?? 0, def.progressTarget)
                  : null;

                return (
                  <View key={def.slug} style={[styles.achievementItem, !unlocked && styles.achievementItemLocked]}>
                    <View style={[
                      styles.achievementBadge,
                      unlocked ? styles.achievementBadgeUnlocked : styles.achievementBadgeLocked,
                    ]}>
                      {/* Canonical IconGlyph set (§ 13.5). Locked icons
                          stay visible at reduced opacity instead of
                          being swapped to a neutral glyph — silhouette
                          recognition still teaches the user what's on
                          offer. */}
                      <IconGlyph
                        name={def.icon}
                        size={20}
                        color={unlocked ? colors.accent : 'rgba(255,255,255,0.55)'}
                      />
                    </View>
                    <Text style={[styles.achievementName, !unlocked && styles.achievementNameLocked]} numberOfLines={1}>
                      {def.name}
                    </Text>
                    <Text style={styles.achievementHint} numberOfLines={2}>
                      {def.description}
                    </Text>
                    {unlocked ? (
                      <Text style={styles.achievementUnlockedTag}>● ZDOBYTE</Text>
                    ) : currentProgress != null && def.progressTarget ? (
                      <Text style={styles.achievementProgress}>
                        {currentProgress}/{def.progressTarget}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </>
        )}

        <View style={styles.sectionDivider} />

        {/* Konto — nav links. Boundary between badges/achievements
            and account-management lives in spacing only; canonical
            screens use whitespace, not a drawn rule. */}
        <View>
          <SectionHead label="Konto" />
        </View>
        <View style={styles.appActions}>
          <Pressable style={styles.actionLink} onPress={() => router.push('/help')}>
            <Text style={styles.actionLinkText}>POMOC</Text>
          </Pressable>
          {/* B20 review: ZASADY button removed — /help already surfaces
              league rules as its first section. */}
          {isAuthenticated && (
            <Pressable style={styles.actionLink} onPress={handleSignOut}>
              <Text style={[styles.actionLinkText, { color: colors.danger }]}>WYLOGUJ</Text>
            </Pressable>
          )}
        </View>

        {/* Stopka — app info + legal. Last block on the page, visually
            quiet so it reads as chrome not content. */}
        <View style={styles.appInfo}>
          <Text style={styles.appInfoText}>New World Disorder</Text>
          <Text style={styles.appInfoText}>Sezon 01 · Beta</Text>
          {isAuthenticated && (
            <Text style={styles.appInfoText}>{authUser?.email ?? ''}</Text>
          )}

          {/* Legal links — always visible, reviewer-reachable */}
          <View style={styles.legalRow}>
            <Pressable onPress={() => Linking.openURL(LEGAL.privacyUrl)}>
              <Text style={styles.legalLinkText}>POLITYKA PRYWATNOŚCI</Text>
            </Pressable>
            <Text style={styles.legalSep}>·</Text>
            <Pressable onPress={() => Linking.openURL(LEGAL.termsUrl)}>
              <Text style={styles.legalLinkText}>REGULAMIN</Text>
            </Pressable>
            <Text style={styles.legalSep}>·</Text>
            <Pressable onPress={() => Linking.openURL(`mailto:${LEGAL.supportEmail}`)}>
              <Text style={styles.legalLinkText}>WSPARCIE</Text>
            </Pressable>
          </View>

          {/* Destructive: delete account */}
          {isAuthenticated && (
            <Pressable
              style={styles.deleteBtn}
              onPress={() => router.push('/settings/delete-account')}
            >
              <Text style={styles.deleteBtnText}>USUŃ KONTO</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Local StatBox (rest of the file consumed it for the stats row) was
// replaced inline with the canonical NwdStatBox import — this leaves
// the styles below to support the player card / achievements grid /
// nav links that remain on bespoke styling for now.

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
  levelNumber: { fontFamily: 'Rajdhani_700Bold', fontSize: 12, color: colors.bg, letterSpacing: 0 },
  rankTitle: { ...typography.label },
  xpSection: { width: '100%', marginTop: spacing.xl },
  xpBarBg: { height: 6, backgroundColor: colors.bgElevated, borderRadius: 3, overflow: 'hidden' },
  xpBarFill: { height: '100%', borderRadius: 3 },
  xpText: { ...typography.labelSmall, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xs },
  rankProgressSection: { width: '100%', marginTop: spacing.md },
  rankProgressText: { ...typography.labelSmall, color: colors.textTertiary, textAlign: 'center', marginTop: spacing.xs, fontSize: 10 },
  // statsRow now hosts canonical NwdStatBox children — the legacy
  // `statBox` / `statValue` / `statLabel` keys were dropped.
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xxl, marginTop: spacing.sm },
  achievementGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achievementItem: { width: '47%', backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.md, alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  achievementBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bgElevated, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  achievementBadgeUnlocked: { borderColor: colors.accent, backgroundColor: colors.accentDim },
  achievementBadgeLocked: { borderColor: colors.mutedBorder, backgroundColor: colors.mutedSurface },
  achievementBadgeText: { fontFamily: 'Rajdhani_700Bold', fontSize: 12, color: colors.textTertiary },
  achievementName: { ...typography.bodySmall, color: colors.textPrimary, textAlign: 'center', fontFamily: 'Inter_600SemiBold' },
  achievementNameLocked: { color: colors.textSecondary },
  achievementHint: { ...typography.labelSmall, color: colors.textTertiary, textAlign: 'center', fontSize: 9, opacity: 0.85, marginTop: 2 },
  achievementUnlockedTag: { fontFamily: 'Rajdhani_700Bold', fontSize: 9, color: colors.accent, letterSpacing: 1.2, marginTop: 6 },
  achievementProgress: { fontFamily: 'Rajdhani_700Bold', fontSize: 11, color: colors.textSecondary, marginTop: 6, letterSpacing: 0.5 },
  achievementItemLocked: { opacity: 0.82 },
  signInCard: {
    gap: 18,
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  signInCta: {
    width: '62%',
    minWidth: 220,
    alignSelf: 'center',
  },
  anonTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    lineHeight: 22,
    color: colors.textPrimary,
    fontWeight: '800',
    letterSpacing: 4.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  anonBody: {
    ...typography.body,
    fontSize: 19,
    lineHeight: 28,
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: 520,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.borderMid,
    marginTop: spacing.xxl,
    marginBottom: spacing.xl,
  },
  appInfo: { alignItems: 'center', paddingTop: spacing.xxl, paddingBottom: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.xxl, gap: spacing.xxs },
  appInfoText: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 10, letterSpacing: 1 },
  // flex-wrap so a 4th or 5th action pill falls to a second row
  // instead of horizontal-overflow clipping — Darek flagged this
  // the moment ZAPROŚ landed. Horizontal padding compacted from
  // lg -> md and gap kept generous so wrapped rows still breathe.
  appActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, rowGap: spacing.sm, marginTop: spacing.lg, justifyContent: 'center' },
  actionLink: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radii.sm },
  actionLinkText: { ...typography.labelSmall, color: colors.textSecondary, letterSpacing: 2 },
  legalRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: spacing.xs, marginTop: spacing.lg, paddingHorizontal: spacing.md },
  legalLinkText: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 1, fontSize: 9, textDecorationLine: 'underline' },
  legalSep: { color: colors.textTertiary, fontSize: 9, marginHorizontal: 2 },
  deleteBtn: { marginTop: spacing.xl, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderWidth: 1, borderColor: colors.danger, borderRadius: radii.sm, alignSelf: 'center' },
  deleteBtnText: { ...typography.labelSmall, color: colors.danger, letterSpacing: 2, fontSize: 10 },
});
