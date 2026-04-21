// ═══════════════════════════════════════════════════════════
// Home — Ye brutalist rebuild (ADR-013).
//
// Structure (top → bottom):
//   1. Header: NWD logo + S01 / WK
//   2. Rider hero: name + tier + XP bar + progress
//   3. Next session: context-aware CTA pointing to closest recent trail
//      with delta-to-rival push mechanic
//   4. Ośrodki list: 3 info per row (name, status, km/trails)
//   5. Brand footer
//
// Emerald rule: <5% of screen. Used for LIVE/LVL/XP/delta/push only.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tapLight } from '@/systems/haptics';
import { getRank, getXpToNextRank } from '@/systems/ranks';
import { hudColors, hudType, hudSpacing } from '@/theme/gameHud';
import { formatTimeShort } from '@/content/copy';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  useProfile,
  useUserTrailStats,
  useLeaderboard,
  useActiveSpots,
  useTrails,
} from '@/hooks/useBackend';

const VENUE_STORAGE_KEY = '@nwd_selected_venue';

export default function HomeScreen() {
  const router = useRouter();
  const { profile: authProfile, isAuthenticated } = useAuthContext();

  const [selectedVenueId, setSelectedVenueId] = useState('');
  useEffect(() => {
    AsyncStorage.getItem(VENUE_STORAGE_KEY).then((stored) => {
      if (stored) setSelectedVenueId(stored);
    });
  }, []);

  const { spots: activeSpots, status: activeSpotsStatus } = useActiveSpots();
  const { trails: venueTrails } = useTrails(selectedVenueId || null);

  useEffect(() => {
    if (activeSpotsStatus === 'loading') return;
    if (!activeSpots.some((s) => s.id === selectedVenueId)) {
      const next = activeSpots[0]?.id ?? '';
      setSelectedVenueId(next);
      if (next) AsyncStorage.setItem(VENUE_STORAGE_KEY, next);
      else AsyncStorage.removeItem(VENUE_STORAGE_KEY);
    }
  }, [activeSpotsStatus, activeSpots, selectedVenueId]);

  const selectedSpot =
    activeSpots.find((s) => s.id === selectedVenueId) ?? activeSpots[0] ?? null;

  const { profile: user } = useProfile(authProfile?.id);
  const { stats: trailStats } = useUserTrailStats(authProfile?.id);

  const nextSession = useMemo(() => {
    if (!selectedSpot || venueTrails.length === 0) return null;
    const withPb = venueTrails.find((t) => {
      const s = trailStats.get(t.id);
      return s?.pbMs != null && s.pbMs > 0;
    });
    const chosen = withPb ?? venueTrails[0];
    const stat = trailStats.get(chosen.id);
    return {
      trail: chosen,
      spotName: selectedSpot.name,
      pbMs: stat?.pbMs ?? null,
      position: stat?.position ?? null,
    };
  }, [selectedSpot, venueTrails, trailStats]);

  const { entries: nextSessionBoard } = useLeaderboard(
    nextSession?.trail.id ?? '',
    'all_time',
    authProfile?.id,
  );

  const push = useMemo(() => {
    if (!nextSession || nextSessionBoard.length === 0) return null;
    const me = nextSessionBoard.find((e) => e.isCurrentUser);
    if (!me) {
      return { kind: 'no_time' as const, totalRiders: nextSessionBoard.length };
    }
    if (me.currentPosition === 1) {
      const chaser = nextSessionBoard.find((e) => e.currentPosition === 2);
      const gap = chaser ? (me.bestDurationMs - chaser.bestDurationMs) / 1000 : 0;
      return { kind: 'defending' as const, chaserGap: Math.abs(gap) };
    }
    const rival = nextSessionBoard.find((e) => e.currentPosition === me.currentPosition - 1);
    const delta = rival ? (me.bestDurationMs - rival.bestDurationMs) / 1000 : 0;
    return {
      kind: 'chasing' as const,
      targetPos: me.currentPosition - 1,
      deltaSec: Math.abs(delta),
    };
  }, [nextSession, nextSessionBoard]);

  const rank = user ? getRank(user.rankId) : getRank('rookie');
  const xpProgress = getXpToNextRank(user?.xp ?? 0);

  const handleEnterLeague = useCallback(() => {
    tapLight();
    if (!isAuthenticated) { router.push('/auth'); return; }
    if (nextSession?.trail.id) router.push(`/trail/${nextSession.trail.id}`);
    else if (selectedSpot?.id) router.push(`/spot/${selectedSpot.id}`);
  }, [isAuthenticated, nextSession, selectedSpot, router]);

  const handleSpotPress = useCallback((spotId: string) => {
    tapLight();
    router.push(`/spot/${spotId}`);
  }, [router]);

  const handleSeeAllSpots = useCallback(() => {
    tapLight();
    router.push('/(tabs)/leaderboard');
  }, [router]);

  const weekNumber = isoWeekNumber(new Date());

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* 1. HEADER */}
        <View style={styles.header}>
          <Text style={styles.brand}>NWD</Text>
          <Text style={styles.headerMeta}>{`S01 / WK ${String(weekNumber).padStart(2, '0')}`}</Text>
        </View>

        {/* 2. RIDER HERO */}
        <View style={styles.hero}>
          <Text style={styles.kicker}>RIDER</Text>
          <Text style={styles.riderName}>
            {user?.username ?? (isAuthenticated ? '—' : 'zaloguj')}
          </Text>

          {user && (
            <>
              <View style={styles.tierRow}>
                <Text style={styles.tierLabel}>{rank.name.toUpperCase()}</Text>
                <View style={styles.tierDot} />
                <Text style={styles.tierLevel}>LVL {Math.max(1, Math.floor(user.xp / 500) + 1)}</Text>
              </View>

              <View style={styles.xpTrack}>
                <View style={[styles.xpFill, { width: `${Math.round(xpProgress.progress * 100)}%` }]} />
              </View>

              <View style={styles.xpRow}>
                <Text style={styles.xpLeft}>{user.xp} XP</Text>
                <Text style={styles.xpRight}>
                  {xpProgress.nextRank
                    ? `→ ${xpProgress.nextRank.name.toUpperCase()} / ${xpProgress.nextRank.xpThreshold - user.xp}`
                    : 'MAX'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* 3. NEXT SESSION */}
        {nextSession && (
          <View style={styles.section}>
            <Text style={styles.kicker}>NAJBLIŻSZA SESJA</Text>
            <Text style={styles.sessionTitle}>
              {`${nextSession.spotName} — ${nextSession.trail.name}`}
            </Text>

            {nextSession.pbMs != null ? (
              <Text style={styles.sessionMeta}>
                {`TWÓJ PB ${formatTimeShort(nextSession.pbMs)}`}
                {nextSession.position ? ` · #${nextSession.position} / ${nextSessionBoard.length}` : ''}
              </Text>
            ) : (
              <Text style={styles.sessionMeta}>
                {`BEZ CZASU · ${nextSessionBoard.length || 0} RIDER${(nextSessionBoard.length || 0) === 1 ? '' : 'ÓW'}`}
              </Text>
            )}

            {push?.kind === 'chasing' && (
              <Text style={styles.pushText}>
                {`-${push.deltaSec.toFixed(2)}s DO ${positionLabel(push.targetPos)}`}
              </Text>
            )}
            {push?.kind === 'defending' && (
              <Text style={styles.pushText}>
                {`TRZYMAJ POZYCJĘ · KOLEJNY ZA +${push.chaserGap.toFixed(2)}s`}
              </Text>
            )}
            {push?.kind === 'no_time' && (
              <Text style={styles.pushText}>
                {`DOŁĄCZ DO ${push.totalRiders} RIDER${push.totalRiders === 1 ? 'A' : 'ÓW'}`}
              </Text>
            )}

            <Pressable
              onPress={handleEnterLeague}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaLabel}>WEJDŹ DO LIGI</Text>
            </Pressable>
          </View>
        )}

        {!nextSession && activeSpotsStatus !== 'loading' && (
          <View style={styles.section}>
            <Text style={styles.kicker}>ZACZNIJ OD PIERWSZEJ TRASY</Text>
            <Text style={styles.sessionTitle}>Zostań pierwszym Pionierem</Text>
            <Text style={styles.sessionMeta}>
              ZGŁOŚ BIKE PARK · DODAJ TRASĘ · JEDŹ
            </Text>
            <Pressable
              onPress={() => { tapLight(); router.push('/spot/new'); }}
              style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
            >
              <Text style={styles.ctaLabel}>ZGŁOŚ BIKE PARK</Text>
            </Pressable>
          </View>
        )}

        {/* 4. OŚRODKI / BIKE PARKS */}
        {activeSpots.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.kicker}>{`OŚRODKI / ${String(activeSpots.length).padStart(2, '0')}`}</Text>
              <Pressable onPress={handleSeeAllSpots} hitSlop={8}>
                <Text style={styles.sectionLink}>ZOBACZ WSZYSTKIE →</Text>
              </Pressable>
            </View>

            {activeSpots.slice(0, 3).map((spot, index) => (
              <SpotRow
                key={spot.id}
                spot={spot}
                isFirst={index === 0}
                onPress={() => handleSpotPress(spot.id)}
              />
            ))}
          </View>
        )}

        {/* 5. BRAND FOOTER */}
        <View style={styles.brandFooter}>
          <Text style={styles.brandLine}>NEW WORLD DISORDER</Text>
          <Text style={styles.brandSub}>SEZON 01 / 2026</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Spot row — pulls its own trail count so the list doesn't require
// a global batch hook. Disabled opacity when no trails yet.
function SpotRow({
  spot,
  isFirst,
  onPress,
}: {
  spot: { id: string; name: string; region: string; trailCount: number };
  isFirst: boolean;
  onPress: () => void;
}) {
  const { trails: spotTrails } = useTrails(spot.id);
  const trailCount = spotTrails.length;
  const hasTrails = trailCount > 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.spotRow,
        !isFirst && styles.spotRowDivider,
        !hasTrails && styles.spotRowDisabled,
        pressed && styles.spotRowPressed,
      ]}
    >
      <View style={styles.spotRowTop}>
        <Text style={styles.spotName}>{spot.name}</Text>
        <Text style={[styles.spotStatus, hasTrails && { color: hudColors.signal }]}>
          {hasTrails ? 'LIVE' : 'WKRÓTCE'}
        </Text>
      </View>
      {hasTrails ? (
        <Text style={styles.spotMeta}>
          {`${spot.region.toUpperCase()} · ${trailCount} TRAS${trailCount === 1 ? 'A' : trailCount < 5 ? 'Y' : ''}`}
        </Text>
      ) : (
        <Text style={styles.spotMetaEmpty}>czeka na pierwszego Pioniera</Text>
      )}
    </Pressable>
  );
}

function isoWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const diff = (date.getTime() - firstThursday.getTime()) / 86400000;
  return 1 + Math.round((diff - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

function positionLabel(pos: number): string {
  const map: Record<number, string> = {
    1: 'PIERWSZEGO',  2: 'DRUGIEGO',    3: 'TRZECIEGO',
    4: 'CZWARTEGO',   5: 'PIĄTEGO',     6: 'SZÓSTEGO',
    7: 'SIÓDMEGO',    8: 'ÓSMEGO',      9: 'DZIEWIĄTEGO',
    10: 'DZIESIĄTEGO',
  };
  return map[pos] ?? `#${pos}`;
}

const HAIRLINE = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hudColors.surface.base },
  scroll: {
    paddingHorizontal: hudSpacing.xxl,
    paddingTop: hudSpacing.lg,
    paddingBottom: hudSpacing.giant,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: hudSpacing.md,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: hudColors.surface.border,
  },
  brand: { ...hudType.displayXs, fontSize: 13, color: hudColors.text.primary, letterSpacing: 2 },
  headerMeta: { ...hudType.label, color: hudColors.text.secondary },

  hero: { paddingTop: hudSpacing.mega },
  kicker: { ...hudType.label, color: hudColors.text.secondary, marginBottom: hudSpacing.sm },
  riderName: { ...hudType.heroRider, color: hudColors.text.primary },

  tierRow: { flexDirection: 'row', alignItems: 'center', gap: hudSpacing.sm, marginTop: hudSpacing.md },
  tierLabel: { ...hudType.stat, color: hudColors.text.primary },
  tierDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: hudColors.text.muted },
  tierLevel: { ...hudType.stat, color: hudColors.signal },

  xpTrack: {
    height: 2,
    backgroundColor: hudColors.surface.border,
    marginTop: hudSpacing.md,
    overflow: 'hidden',
  },
  xpFill: { height: '100%', backgroundColor: hudColors.signal },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: hudSpacing.xs },
  xpLeft:  { ...hudType.stat, color: hudColors.text.secondary },
  xpRight: { ...hudType.stat, color: hudColors.text.secondary },

  section: {
    paddingTop: hudSpacing.xxxl,
    marginTop: hudSpacing.xxxl,
    borderTopWidth: HAIRLINE,
    borderTopColor: hudColors.surface.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hudSpacing.md,
  },
  sectionLink: { ...hudType.labelSm, color: hudColors.text.secondary },

  sessionTitle: { ...hudType.displayMd, color: hudColors.text.primary, marginTop: hudSpacing.xs },
  sessionMeta: {
    ...hudType.caption,
    color: hudColors.text.secondary,
    marginTop: hudSpacing.sm,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  pushText: {
    ...hudType.caption,
    color: hudColors.signal,
    marginTop: hudSpacing.xs,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  cta: {
    marginTop: hudSpacing.xl,
    alignSelf: 'center',
    minWidth: 240,
    paddingVertical: hudSpacing.md,
    paddingHorizontal: hudSpacing.xxl,
    borderWidth: 1,
    borderColor: hudColors.text.primary,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: hudColors.text.primary },
  ctaLabel: {
    ...hudType.label,
    color: hudColors.text.primary,
    fontSize: 11,
    letterSpacing: 3,
  },

  spotRow: { paddingVertical: hudSpacing.xxl },
  spotRowDivider: { borderTopWidth: HAIRLINE, borderTopColor: hudColors.surface.border },
  spotRowDisabled: { opacity: 0.5 },
  spotRowPressed: { opacity: 0.7 },
  spotRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  spotName: { ...hudType.displaySm, color: hudColors.text.primary, flex: 1, paddingRight: hudSpacing.sm },
  spotStatus: { ...hudType.labelSm, color: hudColors.text.secondary },
  spotMeta: {
    ...hudType.caption,
    color: hudColors.text.secondary,
    marginTop: hudSpacing.xs,
    letterSpacing: 1.5,
  },
  spotMetaEmpty: {
    ...hudType.displayXs,
    color: hudColors.text.muted,
    marginTop: hudSpacing.xs,
    fontStyle: 'italic',
    fontSize: 12,
  },

  brandFooter: { paddingTop: hudSpacing.massive, alignItems: 'center' },
  brandLine: { ...hudType.displayXs, fontSize: 11, letterSpacing: 4, color: hudColors.text.primary },
  brandSub: { ...hudType.captionSm, color: hudColors.text.muted, marginTop: hudSpacing.xs },
});
