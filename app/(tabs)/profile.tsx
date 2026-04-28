// ─────────────────────────────────────────────────────────────
// /(tabs)/profile — Paszport Ridera (JA).
//
// Not a generic profile screen and not a settings page. JA answers
// one question: "Co zdobyłem, kim jestem w tej lidze, co zostaje
// ze mną na zawsze?". Layout:
//
//   1. IDENTITY HERO  — avatar + handle + rank + season + rank bar
//                       (sliders icon top-right pushes /settings)
//   2. DOROBEK        — 4 truthful metrics: Pionier / Rekordy PB /
//                       Bike parki / Passa
//   3. PASY           — achievement grid, locked + unlocked
//   4. REKORDY        — per-trail PB list, sorted by position
//
// All settings, legal links and destructive actions live behind
// the gear icon to keep the passport free of admin chrome.
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { getRank, getXpToNextRank } from '@/systems/ranks';
import { getLevel } from '@/systems/xp';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  useAchievements,
  useProfile,
  useStreakState,
} from '@/hooks/useBackend';
import { useTablicaSections } from '@/hooks/useTablicaSections';
import { RiderAvatar } from '@/components/RiderAvatar';
import { SyncOutboxCard } from '@/components/sync/SyncOutboxCard';
import {
  IconGlyph,
  type IconName,
  SectionHead,
} from '@/components/nwd';
import { IdentityHero } from '@/components/profile/IdentityHero';
import { DorobekGrid } from '@/components/profile/DorobekGrid';
import { PersonalRecordsList } from '@/components/profile/PersonalRecordsList';
import { triggerRefresh } from '@/hooks/useRefresh';
import { fetchUserRuns } from '@/lib/api';
import { purgeOrphanedRuns } from '@/systems/runStore';
import { derivePassport } from '@/features/profile/passport';
import { deriveAchievementStatus } from '@/features/profile/achievement';

type AchievementDef = {
  slug: string;
  name: string;
  icon: IconName;
  description: string;
  progressField?: 'totalRuns' | 'totalPbs';
  progressTarget?: number;
};

// Polish-first names. Slugs stay stable so backend achievement
// records keep their identity across the rename. Descriptions
// were already Polish — only the display labels change.
const ACHIEVEMENT_CATALOG: readonly AchievementDef[] = [
  { slug: 'first-blood', name: 'Pierwszy ślad', icon: 'verified', description: 'Pierwszy zweryfikowany zjazd', progressField: 'totalRuns', progressTarget: 1 },
  { slug: 'top-10-entry', name: 'Top 10', icon: 'podium', description: 'Wejdź do TOP 10 na dowolnej trasie' },
  { slug: 'weekend-warrior', name: 'Weekendowy rajder', icon: 'flag', description: '3 zjazdy w jeden weekend' },
  // double-pb unlocks on "two PBs in one day" — a server-side rule
  // that totalPbs (lifetime) doesn't approximate. We deliberately
  // omit progressField here so the card never shows "2/2" while
  // locked: a misleading scalar would lie about an unmet unlock.
  { slug: 'double-pb', name: 'Podwójny PB', icon: 'rec', description: 'Dwa rekordy w jeden dzień' },
  { slug: 'trail-hunter', name: 'Łowca tras', icon: 'spot', description: 'Zjedź każdą trasę w bike parku' },
  { slug: 'slotwiny-local', name: 'Lokalny bohater', icon: 'bike', description: '20 zjazdów łącznie', progressField: 'totalRuns', progressTarget: 20 },
  { slug: 'gravity-addict', name: 'Gravity addict', icon: 'line', description: '50 zjazdów łącznie', progressField: 'totalRuns', progressTarget: 50 },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { profile: authProfile, isAuthenticated } = useAuthContext();
  const { profile: user } = useProfile(authProfile?.id);
  const { achievements } = useAchievements(authProfile?.id);
  const { sections } = useTablicaSections(authProfile?.id);
  const { streak } = useStreakState(authProfile?.id);

  const [refreshing, setRefreshing] = useState(false);

  const rank = user ? getRank(user.rankId) : getRank('rookie');
  const level = getLevel(user?.xp ?? 0);
  const rankProgress = getXpToNextRank(user?.xp ?? 0);
  const passport = derivePassport({
    sections,
    pioneerCount: user?.pioneeredVerifiedCount ?? 0,
    passaDays: streak?.days ?? 0,
  });

  // Pull-to-refresh — preserves the original DB-reconciliation step
  // (purges locally-cached orphaned runs the backend no longer owns).
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
          // Leave cache intact on failure — see commit 2026-04 notes.
          console.warn('[NWD] handleRefresh: DB sync skipped —', err);
        }
      }
      await new Promise((r) => setTimeout(r, 300));
    } finally {
      setRefreshing(false);
    }
  }, [userId]);


  // ─── Auth wall guard — defensive only ────────────────────────
  // Tabs are unreachable without auth (bootstrap → onboarding →
  // /auth → /(tabs)). This effect is the seat-belt: if that wall
  // ever leaks (e.g. a bug in useBetaFlow), redirect rather than
  // letting the screen crash on null user.id derefs.
  useEffect(() => {
    if (!isAuthenticated) router.replace('/auth');
  }, [isAuthenticated, router]);
  if (!isAuthenticated) return null;

  const seasonLine = `SEZON 01 · ${user?.totalRuns ?? 0} ZJAZDÓW`;
  const rankProgressDisplay = rankProgress.nextRank
    ? {
        fromLabel: rank.name,
        toLabel: rankProgress.nextRank.name,
        ratio: rankProgress.progress,
        captionRight: `${rankProgress.xpNeeded} XP do awansu`,
        fromColor: rank.color,
        toColor: rankProgress.nextRank.color,
      }
    : {
        fromLabel: rank.name,
        toLabel: null,
        ratio: 1,
        captionRight: 'MAX RANGA',
        fromColor: rank.color,
        toColor: rank.color,
      };

  return (
    <SafeAreaView style={styles.container}>
      {/* AmbientScan removed from JA — its scan-line caught the hero
          at avatar height and read like a stray separator. The HUD
          ambience stays on Home; passport stays calm. */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <IdentityHero
          avatar={
            <RiderAvatar
              avatarUrl={user?.avatarUrl}
              username={user?.username ?? 'R'}
              size={96}
              borderColor={rank.color}
            />
          }
          riderTag={user?.username ?? 'rider'}
          rankLabel={rank.name}
          rankColor={rank.color}
          level={level}
          seasonLine={seasonLine}
          rankProgress={rankProgressDisplay}
          onSettingsPress={() => router.push('/settings')}
        />

        <SyncOutboxCard />

        {/* DOROBEK — four truthful permanent-record metrics. */}
        <View style={styles.section}>
          <SectionHead label="Dorobek" icon="podium" />
          <DorobekGrid
            stats={[
              { label: 'PIONIER TRAS', value: passport.pioneerCount, tone: 'gold' },
              { label: 'PB TRAS', value: passport.pbCount, tone: 'gold' },
              { label: 'BIKE PARKI', value: passport.bikeParksCount, tone: 'green' },
              {
                label: 'PASSA',
                value: passport.passaDays,
                unit: passport.passaDays === 1 ? 'dzień' : 'dni',
                tone: 'green',
              },
            ]}
          />
        </View>

        {/* PASY — achievement grid, unlocked + locked-with-progress. */}
        <View style={styles.section}>
          <SectionHead
            label="Pasy"
            count={`${achievements.length}/${ACHIEVEMENT_CATALOG.length}`}
          />
          <View style={styles.achievementGrid}>
            {ACHIEVEMENT_CATALOG.map((def) => {
              // Unlock + progress derivation is a pure function so
              // tests can pin the "no 100% locked chip" invariant.
              const status = deriveAchievementStatus(def, achievements, {
                totalRuns: user?.totalRuns,
                totalPbs: user?.totalPbs,
              });
              return (
                <View
                  key={def.slug}
                  style={[styles.achievementItem, !status.isUnlocked && styles.achievementItemLocked]}
                >
                  <View
                    style={[
                      styles.achievementBadge,
                      status.isUnlocked ? styles.achievementBadgeUnlocked : styles.achievementBadgeLocked,
                    ]}
                  >
                    <IconGlyph
                      name={def.icon}
                      size={20}
                      color={status.isUnlocked ? colors.accent : 'rgba(255,255,255,0.55)'}
                    />
                  </View>
                  <Text
                    style={[styles.achievementName, !status.isUnlocked && styles.achievementNameLocked]}
                    numberOfLines={1}
                  >
                    {def.name}
                  </Text>
                  <Text style={styles.achievementHint} numberOfLines={2}>
                    {def.description}
                  </Text>
                  {status.isUnlocked ? (
                    <Text style={styles.achievementUnlockedTag}>● ZDOBYTE</Text>
                  ) : status.displayProgress != null && status.displayTarget != null ? (
                    <Text style={styles.achievementProgress}>
                      {status.displayProgress}/{status.displayTarget}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
        </View>

        {/* REKORDY OSOBISTE — per-trail PBs sorted by position. */}
        <View style={styles.section}>
          <SectionHead label="Rekordy osobiste" icon="rec" />
          <PersonalRecordsList
            records={passport.records}
            onRecordPress={(record) =>
              router.push({
                pathname: '/trail/[id]/ranking',
                params: { id: record.trailId },
              })
            }
          />
        </View>
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.xl,
  },
  section: {
    gap: 12,
  },

  // PASY grid (kept inline — same shape as before).
  achievementGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  achievementItem: {
    flexBasis: '48%',
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    gap: 6,
    minHeight: 132,
  },
  // Locked cards used to flatten with `opacity: 0.7`, which read as
  // "disabled form field". They should read as "earnable" — title
  // and description stay readable, the badge gets a stronger border
  // so the silhouette pops on dark, and the progress chip leans on
  // accent so the rider sees the gap to unlock.
  achievementItemLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderColor: colors.borderMid,
  },
  achievementBadge: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  achievementBadgeUnlocked: {
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.borderHot,
  },
  achievementBadgeLocked: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  achievementName: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  achievementNameLocked: {
    // Stay readable, just slightly cooler so unlocked still pops.
    color: 'rgba(242, 244, 243, 0.85)',
  },
  achievementHint: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  achievementUnlockedTag: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.4,
    marginTop: 2,
  },
  achievementProgress: {
    fontFamily: 'JetBrainsMono_700Bold',
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 1.2,
    marginTop: 2,
  },
});
