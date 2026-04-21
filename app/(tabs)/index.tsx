// ═══════════════════════════════════════════════════════════
// Home — liga gravity radar
// Off-mountain: shows venue, rider status, board entry
// Not a dashboard. A league lobby.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPendingSaveCount, subscribeFinalizedRun } from '@/systems/runStore';
import { flushSaveQueue } from '@/systems/saveQueue';
import { tapLight } from '@/systems/haptics';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailColor } from '@/theme/map';
import { getAllVenues, getVenue } from '@/data/venues';
import { getRank, getXpToNextRank } from '@/systems/ranks';
import { formatTimeShort } from '@/content/copy';
import { useAuthContext } from '@/hooks/AuthContext';
import { useProfile, useUserTrailStats, useLeaderboard, useVenueActivity, useLeagueMovement, usePendingSpots, useMyPendingSpots, useActiveSpots, useTrails } from '@/hooks/useBackend';
import { LeagueSignal } from '@/systems/leagueMovement';
import { useVenueContext } from '@/hooks/useVenueContext';
import { PioneerBadge } from '@/components/game/PioneerBadge';

const VENUE_STORAGE_KEY = '@nwd_selected_venue';

export default function HomeScreen() {
  const router = useRouter();
  const { profile: authProfile, isAuthenticated } = useAuthContext();

  // ── Venue selection (persisted) ──
  const [selectedVenueId, setSelectedVenueId] = useState('');
  useEffect(() => {
    AsyncStorage.getItem(VENUE_STORAGE_KEY).then((stored) => {
      if (stored && getVenue(stored)) setSelectedVenueId(stored);
    });
  }, []);

  const handleVenueSelect = useCallback((venueId: string) => {
    tapLight();
    setSelectedVenueId(venueId);
    AsyncStorage.setItem(VENUE_STORAGE_KEY, venueId);
  }, []);

  const allVenues = getAllVenues();
  const venue = getVenue(selectedVenueId);

  // Checkpoint A: swap mock-sourced spot/trails to DB-backed hooks.
  // Venue picker rail still uses getAllVenues() from seed registry —
  // Checkpoint B will rewire it to the same active-spots source.
  const { spots: activeSpots, status: activeSpotsStatus } = useActiveSpots();
  const { trails: venueTrails } = useTrails(selectedVenueId || null);
  const spot = activeSpots.find((s) => s.id === selectedVenueId) ?? activeSpots[0] ?? null;

  // ADD 1: recover from stale AsyncStorage selection once the active
  // list arrives. If the persisted ID is not in the DB, switch to the
  // first active spot (or clear when DB is empty).
  useEffect(() => {
    if (activeSpotsStatus === 'loading') return;
    const exists = activeSpots.some((s) => s.id === selectedVenueId);
    if (!exists) {
      const next = activeSpots[0]?.id ?? '';
      setSelectedVenueId(next);
      if (next) AsyncStorage.setItem(VENUE_STORAGE_KEY, next);
      else AsyncStorage.removeItem(VENUE_STORAGE_KEY);
    }
  }, [activeSpotsStatus, activeSpots, selectedVenueId]);

  // Featured trail = first trail of selected venue (for board preview)
  // ADD 2: guard against stale seed IDs that are not actually in the
  // DB-backed trail list for this spot — skip the leaderboard call.
  const featuredTrailId = venue?.trails[0]?.id ?? venueTrails[0]?.id;
  const featuredTrailExists = !!featuredTrailId && venueTrails.some((t) => t.id === featuredTrailId);
  const featuredTrailIdForBoard = featuredTrailExists ? (featuredTrailId as string) : '';

  const { profile: user, status: profileStatus } = useProfile(authProfile?.id);
  const { stats: trailStats, status: trailStatsStatus } = useUserTrailStats(authProfile?.id);
  const { entries: topBoard, status: boardStatus } = useLeaderboard(featuredTrailIdForBoard, 'all_time', authProfile?.id);
  const { activity: venueActivity, status: venueActivityStatus } = useVenueActivity(selectedVenueId);
  const venueCtx = useVenueContext(true);

  const { signals: leagueSignals } = useLeagueMovement(authProfile?.id, venueActivity, venueTrails);

  // Sprint 2: spot submission wiring
  const { spots: curatorPending } = usePendingSpots(authProfile?.role ?? null, authProfile?.id);
  const { spots: myPending } = useMyPendingSpots(authProfile?.id);
  const isCurator = authProfile?.role === 'curator' || authProfile?.role === 'moderator';

  // ── Pending saves indicator ──
  const [pendingSaves, setPendingSaves] = useState(getPendingSaveCount());
  useEffect(() => {
    const unsub = subscribeFinalizedRun(() => setPendingSaves(getPendingSaveCount()));
    return unsub;
  }, []);

  const handleFlushQueue = useCallback(() => {
    tapLight();
    flushSaveQueue();
  }, []);

  const isAtVenue = venueCtx.context?.venue.isInsideVenue ?? false;
  const startZone = venueCtx.context?.startZone ?? null;
  const rank = user ? getRank(user.rankId) : getRank('rookie');
  const xpProgress = getXpToNextRank(user?.xp ?? 0);

  // Find rider's best position across all trails
  const bestPos = user?.bestPosition ?? 0;

  // Top rider on featured board
  const topRider = topBoard.length > 0 ? topBoard[0] : null;
  const myBoardEntry = topBoard.find(e => e.isCurrentUser);
  const featuredTrailName = venue?.trails[0]?.name ?? venueTrails[0]?.name ?? 'Trasa';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* ═══ HEADER ═══ */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>NWD</Text>
            <Text style={styles.leagueLabel}>LIGA GRAVITY</Text>
          </View>
          <Pressable
            style={styles.rankPill}
            onPress={() => {
              if (!isAuthenticated) router.push('/auth');
              else router.push('/(tabs)/profile');
            }}
          >
            <Text style={[styles.rankIcon, { color: rank.color }]}>{rank.icon}</Text>
            <Text style={[styles.rankName, { color: rank.color }]}>
              {isAuthenticated ? rank.name : 'ZALOGUJ'}
            </Text>
            {user && (
              <View style={styles.xpMini}>
                <View style={[styles.xpMiniFill, { width: `${xpProgress.progress * 100}%`, backgroundColor: rank.color }]} />
              </View>
            )}
          </Pressable>
        </View>

        {/* ═══ VENUE PICKER RAIL ═══ */}
        {allVenues.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.venueRail}
            contentContainerStyle={styles.venueRailContent}
          >
            {allVenues.map((v) => {
              const isActive = v.id === selectedVenueId;
              return (
                <Pressable
                  key={v.id}
                  style={[styles.venueChip, isActive && styles.venueChipActive]}
                  onPress={() => handleVenueSelect(v.id)}
                >
                  <Text style={[styles.venueChipText, isActive && styles.venueChipTextActive]}>
                    {v.name.toUpperCase()}
                  </Text>
                  {isActive && <View style={styles.venueChipBar} />}
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* ═══ PENDING SAVES BANNER ═══ */}
        {pendingSaves > 0 && (
          <Pressable style={styles.pendingBanner} onPress={handleFlushQueue}>
            <Text style={styles.pendingDot}>●</Text>
            <Text style={styles.pendingText}>
              {pendingSaves === 1 ? '1 zjazd czeka na wysłanie' : `${pendingSaves} zjazdy czekają na wysłanie`}
            </Text>
            <Text style={styles.pendingAction}>WYŚLIJ</Text>
          </Pressable>
        )}

        {/* ═══ CURATOR: PENDING SPOTS QUEUE ═══ */}
        {isCurator && curatorPending.length > 0 && (
          <Pressable
            style={styles.curatorBanner}
            onPress={() => { tapLight(); router.push('/spot/pending'); }}
          >
            <Text style={styles.curatorBannerDot}>●</Text>
            <Text style={styles.curatorBannerText}>
              Pending spots: {curatorPending.length}
            </Text>
            <Text style={styles.curatorBannerAction}>ZOBACZ</Text>
          </Pressable>
        )}

        {/* ═══ RIDER: SUBMIT NEW SPOT CTA ═══ */}
        {isAuthenticated && (
          <Pressable
            style={styles.submitSpotCta}
            onPress={() => { tapLight(); router.push('/spot/new'); }}
          >
            <Text style={styles.submitSpotLabel}>+ ZGŁOŚ BIKE PARK</Text>
          </Pressable>
        )}

        {/* ═══ RIDER: MY PENDING / REJECTED SPOTS ═══ */}
        {myPending.length > 0 && (
          <View style={styles.myPendingBlock}>
            <Text style={styles.myPendingTitle}>TWOJE ZGŁOSZENIA</Text>
            {myPending.map((s) => (
              <View key={s.id} style={styles.myPendingCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myPendingName}>{s.name}</Text>
                  <Text style={styles.myPendingStatus}>
                    {s.status === 'pending' ? 'Oczekuje na zatwierdzenie' : `Odrzucony: ${s.rejectionReason ?? '—'}`}
                  </Text>
                </View>
                <View style={[
                  styles.myPendingBadge,
                  s.status === 'rejected' && styles.myPendingBadgeRejected,
                ]}>
                  <Text style={styles.myPendingBadgeText}>
                    {s.status === 'pending' ? 'OCZEKUJE' : 'ODRZUCONY'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ═══ START-ZONE PROMPT — highest priority when at a start gate ═══ */}
        {isAtVenue && startZone?.isAtStart && startZone.nearestStart && !startZone.ambiguous && (
          <View style={styles.startZoneCard}>
            <Text style={styles.startZoneTag}>JESTEŚ PRZY STARCIE</Text>
            <Text style={styles.startZoneTrail}>{startZone.nearestStart.trailName}</Text>
            <View style={styles.startZoneActions}>
              <Pressable
                style={styles.startZoneRanked}
                onPress={() => {
                  if (!isAuthenticated) {
                    router.push('/auth');
                    return;
                  }
                  router.push({
                    pathname: '/run/active',
                    params: { trailId: startZone.nearestStart?.trailId, trailName: startZone.nearestStart?.trailName },
                  });
                }}
              >
                <Text style={styles.startZoneRankedText}>
                  {isAuthenticated ? 'JEDŹ RANKINGOWO' : 'ZALOGUJ — RANKING'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.startZonePractice}
                onPress={() => router.push({
                  pathname: '/run/active',
                  params: { trailId: startZone.nearestStart?.trailId, trailName: startZone.nearestStart?.trailName },
                })}
              >
                <Text style={styles.startZonePracticeText}>TRENING</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ═══ START-ZONE AMBIGUOUS — multiple trails nearby ═══ */}
        {isAtVenue && startZone?.isAtStart && startZone.ambiguous && (
          <View style={styles.startZoneCard}>
            <Text style={styles.startZoneTag}>JESTEŚ PRZY STARCIE</Text>
            <Text style={styles.startZoneHint}>Wybierz trasę</Text>
            {startZone.alternatives.map(alt => (
              <Pressable
                key={alt.trailId}
                style={styles.startZoneAlt}
                onPress={() => router.push({
                  pathname: '/run/active',
                  params: { trailId: alt.trailId, trailName: alt.trailName },
                })}
              >
                <Text style={styles.startZoneAltText}>{alt.trailName}</Text>
                <Text style={styles.startZoneAltDist}>{alt.distanceM}m</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ═══ NEAR START — close but not at gate yet ═══ */}
        {isAtVenue && !startZone?.isAtStart && startZone?.isNearStart && startZone.nearestStart && (
          <Pressable
            style={styles.nearStartCard}
            onPress={() => router.push(`/trail/${startZone.nearestStart?.trailId}`)}
          >
            <Text style={styles.nearStartTag}>BLISKO STARTU</Text>
            <Text style={styles.nearStartTrail}>
              {startZone.nearestStart.trailName} · {startZone.nearestStart.distanceM}m
            </Text>
          </Pressable>
        )}

        {/* ═══ VENUE ARRIVAL — at venue but not near any start ═══ */}
        {isAtVenue && !startZone?.isNearStart && (
          <View style={styles.venueArrivalCard}>
            <View style={styles.venueArrivalDot} />
            <Text style={styles.venueArrivalText}>Jesteś w {venueCtx.context?.venue.venueName}</Text>
          </View>
        )}

        {/* ═══ EMPTY STATE — no active spots yet ═══ */}
        {!spot && activeSpotsStatus === 'empty' && (
          <View style={styles.emptyVenueBlock}>
            <Text style={styles.emptyVenueTitle}>Brak bike parków w pobliżu</Text>
            <Text style={styles.emptyVenueBody}>Bądź pierwszym Pionierem.</Text>
            <Pressable
              style={styles.emptyVenueCta}
              onPress={() => { tapLight(); router.push('/spot/new'); }}
            >
              <Text style={styles.emptyVenueCtaLabel}>ZGŁOŚ PIERWSZY BIKE PARK</Text>
            </Pressable>
          </View>
        )}

        {/* ═══ VENUE HERO CARD (only when we have an active spot) ═══ */}
        {spot && (<>
        <Pressable
          style={styles.venueCard}
          onPress={() => router.push(`/spot/${spot.id}`)}
        >
          <View style={styles.venueHeader}>
            <Text style={styles.venueTag}>BIKE PARK · SEZON 01</Text>
          </View>

          <Text style={styles.venueName}>{spot.name}</Text>
          <Text style={styles.venueRegion}>{spot.region}</Text>

          <View style={styles.venueStats}>
            <View style={styles.venueStat}>
              <Text style={styles.venueStatValue}>{venueTrails.length}</Text>
              <Text style={styles.venueStatLabel}>TRAS</Text>
            </View>
            <View style={styles.venueStatDivider} />
            {venueActivityStatus === 'ok' && venueActivity && venueActivity.verifiedRunsToday > 0 ? (
              <>
                <View style={styles.venueStat}>
                  <Text style={[styles.venueStatValue, { color: colors.accent }]}>{venueActivity.verifiedRunsToday}</Text>
                  <Text style={styles.venueStatLabel}>ZJAZDÓW DZIŚ</Text>
                </View>
                <View style={styles.venueStatDivider} />
                <View style={styles.venueStat}>
                  <Text style={[styles.venueStatValue, { color: colors.accent }]}>{venueActivity.activeRidersToday}</Text>
                  <Text style={styles.venueStatLabel}>RIDERÓW DZIŚ</Text>
                </View>
              </>
            ) : venueActivityStatus === 'error' ? (
              <View style={styles.venueStat}>
                <Text style={[styles.venueStatValue, { color: colors.textTertiary }]}>—</Text>
                <Text style={styles.venueStatLabel}>BRAK DANYCH</Text>
              </View>
            ) : (
              <View style={styles.venueStat}>
                <Text style={styles.venueStatValue}>—</Text>
                <Text style={styles.venueStatLabel}>CISZA DZIŚ</Text>
              </View>
            )}
          </View>

          <View style={styles.venueCta}>
            <Text style={styles.venueCtaText}>OTWÓRZ BIKE PARK</Text>
          </View>
        </Pressable>

        {/* ═══ RIDER STATUS ═══ */}
        {isAuthenticated && user ? (
          <View style={styles.riderCard}>
            <Text style={styles.riderCardTag}>TWÓJ STATUS</Text>
            <View style={styles.riderStatsRow}>
              <View style={styles.riderStat}>
                <Text style={styles.riderStatValue}>{user.totalRuns}</Text>
                <Text style={styles.riderStatLabel}>ZJAZDÓW</Text>
              </View>
              <View style={styles.riderStat}>
                <Text style={styles.riderStatValue}>{user.totalPbs}</Text>
                <Text style={styles.riderStatLabel}>REKORDÓW</Text>
              </View>
              <View style={styles.riderStat}>
                <Text style={[styles.riderStatValue, bestPos > 0 ? { color: colors.accent } : {}]}>
                  {bestPos > 0 ? `#${bestPos}` : '—'}
                </Text>
                <Text style={styles.riderStatLabel}>POZYCJA</Text>
              </View>
            </View>
            {myBoardEntry && (
              <View style={styles.riderBoardRow}>
                <Text style={styles.riderBoardLabel}>{featuredTrailName}</Text>
                <Text style={styles.riderBoardPos}>#{myBoardEntry.currentPosition}</Text>
              </View>
            )}
          </View>
        ) : (
          <Pressable style={styles.signInCard} onPress={() => router.push('/auth')}>
            <Text style={styles.signInTitle}>DOŁĄCZ DO LIGI</Text>
            <Text style={styles.signInDesc}>
              Zaloguj się, aby jechać rankingowo i pojawiać się na tablicy.
            </Text>
            <View style={styles.signInCta}>
              <Text style={styles.signInCtaText}>ZALOGUJ</Text>
            </View>
          </Pressable>
        )}

        {/* ═══ LEAGUE MOVEMENT — re-engagement signals ═══ */}
        {leagueSignals.length > 0 && (
          <View style={styles.movementSection}>
            <Text style={styles.movementTag}>RUCH W LIDZE</Text>
            {leagueSignals.map((signal, i) => (
              <Pressable
                key={i}
                style={[
                  styles.movementRow,
                  signal.riderSpecific && styles.movementRowPersonal,
                ]}
                onPress={() => {
                  if (signal.trailId) router.push(`/trail/${signal.trailId}`);
                  else if (signal.venueId) router.push(`/spot/${signal.venueId}`);
                }}
              >
                <View style={styles.movementContent}>
                  <Text style={[
                    styles.movementHeadline,
                    signal.riderSpecific && { color: colors.accent },
                  ]}>
                    {signal.headline}
                  </Text>
                  {signal.detail && (
                    <Text style={styles.movementDetail}>{signal.detail}</Text>
                  )}
                </View>
                <Text style={styles.movementArrow}>→</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* ═══ BOARD ENTRY — top from featured trail ═══ */}
        {topBoard.length > 0 && (
          <Pressable
            style={styles.boardCard}
            onPress={() => router.push('/(tabs)/leaderboard')}
          >
            <Text style={styles.boardTag}>TABLICA · {featuredTrailName.toUpperCase()}</Text>
            {topBoard.slice(0, 3).map((entry) => (
              <View key={entry.userId} style={styles.boardRow}>
                <Text style={[
                  styles.boardPos,
                  entry.currentPosition === 1 && { color: colors.gold },
                  entry.isCurrentUser && { color: colors.accent },
                ]}>
                  {entry.currentPosition}
                </Text>
                <Text style={[
                  styles.boardName,
                  entry.isCurrentUser && { color: colors.accent },
                ]} numberOfLines={1}>
                  {entry.username}
                </Text>
                <Text style={styles.boardTime}>
                  {formatTimeShort(entry.bestDurationMs)}
                </Text>
              </View>
            ))}
            <View style={styles.boardMore}>
              <Text style={styles.boardMoreText}>PEŁNA TABLICA →</Text>
            </View>
          </Pressable>
        )}

        {/* ═══ TRAILS LIST ═══ */}
        <Text style={styles.sectionLabel}>TRASY · {spot.name.toUpperCase()}</Text>
        {venueTrails.map((trail) => {
          const stats = trailStats.get(trail.id);
          const venueTrail = venue?.trails.find((o) => o.id === trail.id);
          const diffColor = getTrailColor(venueTrail?.colorClass, trail.difficulty);
          const hasResult = !!stats?.pbMs;
          return (
            <Pressable
              key={trail.id}
              style={styles.trailRow}
              onPress={() => router.push(`/trail/${trail.id}`)}
            >
              <View style={[styles.trailDot, { backgroundColor: diffColor }]} />
              <View style={styles.trailRowInfo}>
                <View style={styles.trailRowNameLine}>
                  <Text style={styles.trailRowName} numberOfLines={1}>{trail.name}</Text>
                  {trail.pioneerUserId && <PioneerBadge size="xs" />}
                </View>
                <Text style={styles.trailRowMeta}>
                  {trail.difficulty.toUpperCase()} · {trail.distanceM}m · ↓{trail.elevationDropM}m
                </Text>
              </View>
              <View style={styles.trailRowRight}>
                {hasResult ? (
                  <>
                    <Text style={styles.trailRowPb}>{formatTimeShort(stats!.pbMs!)}</Text>
                    {stats!.position && (
                      <Text style={styles.trailRowPos}>#{stats!.position}</Text>
                    )}
                  </>
                ) : (
                  <Text style={styles.trailRowNoPb}>Brak czasu</Text>
                )}
              </View>
            </Pressable>
          );
        })}
        </>)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg, paddingBottom: spacing.huge },

  // Venue picker rail
  venueRail: { marginHorizontal: -spacing.lg, marginBottom: spacing.md },
  venueRailContent: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  venueChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.sm,
    alignItems: 'center' as const,
  },
  venueChipActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  venueChipText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.55)',
    letterSpacing: 2,
  },
  venueChipTextActive: {
    color: colors.textPrimary,
  },
  venueChipBar: {
    width: 16,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: colors.accent,
    marginTop: 4,
  },

  // Pending saves banner
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 204, 0, 0.06)',
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 204, 0, 0.12)',
  },
  pendingDot: { fontSize: 8, color: colors.gold },
  pendingText: { flex: 1, ...typography.bodySmall, color: colors.gold, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  pendingAction: { ...typography.labelSmall, color: colors.gold, letterSpacing: 2, fontSize: 9 },

  // Curator banner — pending spots queue
  curatorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accentDim,
    borderRadius: radii.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  curatorBannerDot: { fontSize: 8, color: colors.accent },
  curatorBannerText: { flex: 1, ...typography.bodySmall, color: colors.accent, fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  curatorBannerAction: { ...typography.labelSmall, color: colors.accent, letterSpacing: 2, fontSize: 9 },

  // Rider: my pending submissions
  myPendingBlock: { marginBottom: spacing.lg },
  myPendingTitle: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, marginBottom: spacing.sm, fontSize: 10 },
  myPendingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.8,
  },
  myPendingName: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  myPendingStatus: { ...typography.bodySmall, color: colors.textTertiary, marginTop: 2 },
  myPendingBadge: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radii.sm, backgroundColor: colors.accentDim },
  myPendingBadgeRejected: { backgroundColor: colors.redDim },
  myPendingBadgeText: { ...typography.labelSmall, color: colors.textPrimary, fontSize: 9, letterSpacing: 1.5 },

  // Empty state — no active spots yet
  emptyVenueBlock: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.xl,
    padding: spacing.xxl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyVenueTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptyVenueBody: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  emptyVenueCta: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  emptyVenueCtaLabel: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 3,
    fontSize: 13,
  },

  // Submit-new-spot CTA (persistent on home)
  submitSpotCta: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
    backgroundColor: colors.bgCard,
  },
  submitSpotLabel: { ...typography.labelSmall, color: colors.textSecondary, letterSpacing: 3, fontSize: 11 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  brand: { fontFamily: 'Rajdhani_700Bold', fontSize: 28, color: colors.textPrimary, letterSpacing: 8 },
  leagueLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, marginTop: spacing.xxs, fontSize: 8 },
  rankPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: colors.bgCard, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderWidth: 1, borderColor: colors.border },
  rankIcon: { fontSize: 14 },
  rankName: { ...typography.labelSmall, letterSpacing: 2 },
  xpMini: { width: 30, height: 3, backgroundColor: colors.bgElevated, borderRadius: 2, overflow: 'hidden' },
  xpMiniFill: { height: '100%', borderRadius: 2 },

  // Start-zone prompt
  startZoneCard: { backgroundColor: colors.bgCard, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 2, borderColor: colors.accent, alignItems: 'center' },
  startZoneTag: { ...typography.labelSmall, color: colors.accent, letterSpacing: 4, marginBottom: spacing.sm, fontSize: 10 },
  startZoneTrail: { fontFamily: 'Rajdhani_700Bold', fontSize: 22, color: colors.textPrimary, letterSpacing: 2, marginBottom: spacing.lg },
  startZoneActions: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  startZoneRanked: { flex: 2, backgroundColor: colors.accent, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  startZoneRankedText: { fontFamily: 'Rajdhani_700Bold', fontSize: 13, color: colors.bg, letterSpacing: 3 },
  startZonePractice: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radii.lg, paddingVertical: spacing.lg, alignItems: 'center' },
  startZonePracticeText: { ...typography.label, color: colors.textSecondary, letterSpacing: 2, fontSize: 11 },
  startZoneHint: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.md },
  startZoneAlt: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  startZoneAltText: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold' },
  startZoneAltDist: { ...typography.labelSmall, color: colors.textTertiary },

  // Near start
  nearStartCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nearStartTag: { ...typography.labelSmall, color: colors.accent, letterSpacing: 3, fontSize: 9 },
  nearStartTrail: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // Venue arrival
  venueArrivalCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.accentDim, borderRadius: radii.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, marginBottom: spacing.lg },
  venueArrivalDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  venueArrivalText: { ...typography.body, color: colors.accent, fontFamily: 'Inter_600SemiBold', fontSize: 14 },

  // Venue card
  venueCard: { backgroundColor: colors.bgCard, borderRadius: radii.xl, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.accent },
  venueHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  venueTag: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, fontSize: 9 },
  venueName: { fontFamily: 'Rajdhani_700Bold', fontSize: 24, color: colors.textPrimary, letterSpacing: 2 },
  venueRegion: { ...typography.bodySmall, color: colors.textSecondary, marginTop: spacing.xxs },
  venueStats: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.md, marginTop: spacing.lg, gap: spacing.sm },
  venueStat: { flex: 1, alignItems: 'center' },
  venueStatValue: { ...typography.h3, color: colors.textPrimary, fontSize: 15 },
  venueStatLabel: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 8, marginTop: 2 },
  venueStatDivider: { width: 1, height: 24, backgroundColor: colors.border },
  venueCta: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.lg },
  venueCtaText: { ...typography.cta, color: colors.bg, letterSpacing: 4, fontSize: 14 },

  // Rider status
  riderCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  riderCardTag: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, marginBottom: spacing.md, fontSize: 9 },
  riderStatsRow: { flexDirection: 'row', gap: spacing.sm },
  riderStat: { flex: 1, alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: radii.sm, paddingVertical: spacing.sm },
  riderStatValue: { ...typography.h3, color: colors.textPrimary },
  riderStatLabel: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 8, marginTop: 2 },
  riderBoardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  riderBoardLabel: { ...typography.bodySmall, color: colors.textSecondary, fontFamily: 'Inter_600SemiBold' },
  riderBoardPos: { fontFamily: 'Rajdhani_700Bold', fontSize: 16, color: colors.accent },

  // Sign-in
  signInCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.xl, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  signInTitle: { ...typography.label, color: colors.textPrimary, letterSpacing: 3, marginBottom: spacing.sm },
  signInDesc: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },
  signInCta: { backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xxl },
  signInCtaText: { ...typography.cta, color: colors.bg, letterSpacing: 3, fontSize: 13 },

  // League movement
  movementSection: { marginBottom: spacing.lg },
  movementTag: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 4, marginBottom: spacing.sm, fontSize: 8 },
  movementRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xs, borderWidth: 1, borderColor: colors.border },
  movementRowPersonal: { borderColor: colors.accent + '30' },
  movementContent: { flex: 1 },
  movementHeadline: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  movementDetail: { ...typography.labelSmall, color: colors.textTertiary, marginTop: 2, fontSize: 10 },
  movementArrow: { color: colors.textTertiary, fontSize: 16, marginLeft: spacing.sm },

  // Board entry
  boardCard: { backgroundColor: colors.bgCard, borderRadius: radii.lg, padding: spacing.lg, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  boardTag: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, marginBottom: spacing.md, fontSize: 9 },
  boardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm, gap: spacing.md },
  boardPos: { fontFamily: 'Rajdhani_700Bold', fontSize: 16, color: colors.textSecondary, width: 28 },
  boardName: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', flex: 1, fontSize: 14 },
  boardTime: { fontFamily: 'Rajdhani_700Bold', fontSize: 13, color: colors.textTertiary, letterSpacing: 1 },
  boardMore: { alignItems: 'center', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, marginTop: spacing.sm },
  boardMoreText: { ...typography.labelSmall, color: colors.accent, letterSpacing: 3 },

  // Trails
  sectionLabel: { ...typography.labelSmall, color: colors.textTertiary, letterSpacing: 3, marginBottom: spacing.md, marginTop: spacing.sm, fontSize: 9 },
  trailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing.md },
  trailDot: { width: 10, height: 10, borderRadius: 5 },
  trailRowInfo: { flex: 1 },
  trailRowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trailRowName: { ...typography.body, color: colors.textPrimary, fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
  trailRowMeta: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 9, marginTop: 2 },
  trailRowRight: { alignItems: 'flex-end' },
  trailRowPb: { ...typography.timeSmall, color: colors.accent, fontSize: 14 },
  trailRowNoPb: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 10 },
  trailRowPos: { ...typography.labelSmall, color: colors.textTertiary, fontSize: 9, marginTop: 2 },
});
