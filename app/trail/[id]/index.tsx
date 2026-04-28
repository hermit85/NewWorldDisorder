// ─────────────────────────────────────────────────────────────
// Trail detail — canonical screens-spot-trail.jsx ScreenTrailDetail
//
// Layout per the canonical reference:
//   TopBar           back + title "Trasa" + S01 pill
//   Spot crumb       optional tappable parent link
//   Hero             "Trasa" pill kicker + h1 trail name + tags
//   Trust + Pioneer  TrustBadge + PioneerBadge identity row
//   Stats grid       3-col StatBox: Długość / Spadek / KOM
//   Status card      HudPanel — myPos + rival + ambition (if authed)
//                    OR sign-in CTA card (if anon)
//   SectionHead      "Tablica" + scope tabs (Dziś/Weekend/Sezon)
//   LeaderboardRow   top-5 + dots + my row pinned (if outside top-5)
//   Action bar       JEDŹ RANKINGOWO primary + TRENING ghost
//
// Draft state (no geometry yet) has its own simpler render path —
// large "Rozpocznij nagrywanie" CTA, no leaderboard.
// ─────────────────────────────────────────────────────────────
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Btn,
  Card,
  HudPanel,
  IconGlyph,
  LeaderboardRow,
  PageTitle,
  Pill,
  SectionHead,
  StatBox,
  TopBar,
} from '@/components/nwd';
import { DifficultyPill, resolveDifficultyTone } from '@/components/ui/DifficultyPill';
import { TrustBadge } from '@/components/game/TrustBadge';
import { PioneerBadge } from '@/components/game/PioneerBadge';
import { useAuthContext } from '@/hooks/AuthContext';
import {
  useDeleteTrail,
  useLeaderboard,
  useSpot,
  useTrail,
  useUserTrailStats,
} from '@/hooks/useBackend';
import { getVenueForTrail } from '@/data/venues';
import { getTrustDisclosure } from '@/lib/trailTrust';
import { formatTime, formatTimeShort } from '@/content/copy';
import { tapLight, tapMedium } from '@/systems/haptics';
import { reportRider } from '@/services/moderation';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import type { PeriodType } from '@/data/types';

const SCOPE_TABS: Array<[PeriodType, string]> = [
  ['day', 'Dziś'],
  ['weekend', 'Weekend'],
  ['all_time', 'Sezon'],
];

function formatPioneerDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// getTrustDisclosure now lives in src/lib/trailTrust.ts (promoted
// after admin queue became the third caller of the same copy).

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuthContext();
  const { trail } = useTrail(id ?? null);
  const { spot } = useSpot(trail?.spotId ?? null);
  const venueMatch = id ? getVenueForTrail(id) : undefined;
  const isTrainingOnly = venueMatch ? !venueMatch.venue.rankingEnabled : false;
  const spotName = spot?.name ?? venueMatch?.venue.name;
  const isCurator = profile?.role === 'curator' || profile?.role === 'moderator';
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
            if (result.ok) goBack();
            else
              Alert.alert(
                `Nie udało się: ${result.code}`,
                result.message ?? 'Spróbuj ponownie',
              );
          },
        },
      ],
    );
  }, [trail, deleteTrail]);

  if (!trail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFoundState}>
          <Text style={styles.notFoundTitle}>TRASA NIE ZNALEZIONA</Text>
          <Text style={styles.notFoundBody}>
            Ten link nie prowadzi już do żadnej trasy.
          </Text>
          <Btn variant="primary" size="lg" onPress={goBack}>
            WRÓĆ DO LISTY
          </Btn>
        </View>
      </SafeAreaView>
    );
  }

  // ── Draft trail — Pioneer hasn't carved geometry yet ───────
  if (trail.calibrationStatus === 'draft' && trail.geometryMissing) {
    const startRecording = () => {
      tapMedium();
      router.push(`/run/recording?trailId=${trail.id}&spotId=${trail.spotId}`);
    };
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <TopBar onBack={goBack} title="Trasa" />

          {spotName ? (
            <Pressable onPress={goToSpot} style={styles.crumb} hitSlop={8}>
              <Text style={styles.crumbLabel}>BIKE PARK</Text>
              <View style={styles.crumbDot} />
              <Text style={styles.crumbName}>{spotName.toUpperCase()}</Text>
            </Pressable>
          ) : null}

          <View style={styles.hero}>
            <View style={styles.heroPillRow}>
              <Pill state="accent">Trasa</Pill>
            </View>
            <PageTitle title={trail.name} hero />
            <Pill state="pending" dot>Draft · czeka na pioniera</Pill>
          </View>

          <Card hi glow padding={20} style={{ gap: 14 }}>
            <View style={styles.draftCtaIcon}>
              <IconGlyph name="rec" size={32} variant="accent" />
            </View>
            <Text style={styles.draftCtaTitle}>ROZPOCZNIJ NAGRYWANIE</Text>
            <Text style={styles.draftCtaBody}>
              Twój pierwszy zjazd wyznaczy linię dla wszystkich.
            </Text>
            <Btn variant="primary" size="lg" onPress={startRecording}>
              Rozpocznij nagrywanie
            </Btn>
          </Card>

          {canDeleteTrail ? (
            <Pressable onPress={handleDeleteTrail} hitSlop={12} style={styles.deleteLink}>
              <Text style={styles.deleteLinkText}>Usuń tę trasę</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Active trail — full board view ─────────────────────────
  const myStats = trailStats.get(trail.id);
  const top5 = leaderboard.slice(0, 5);
  const myEntry = leaderboard.find((e) => e.isCurrentUser);
  const nearestRival = myEntry
    ? leaderboard.find((e) => e.currentPosition === myEntry.currentPosition - 1)
    : null;
  const myPos = myEntry?.currentPosition ?? 0;
  const tierLabel = myPos > 0 && myPos <= 3
    ? 'PODIUM'
    : myPos > 0 && myPos <= 10 ? 'TOP 10'
      : null;
  const placesToNextTier = myPos === 0 ? 0
    : myPos <= 3 ? 0
      : myPos <= 10 ? myPos - 3
        : myPos - 10;
  const tone = resolveDifficultyTone(trail.difficulty, trail.trailType);

  const handleStartRanked = () => {
    if (isTrainingOnly) return;
    // /trail/[id] is outside the tabs stack, so deep links and stale
    // nav stacks can land an unauthenticated rider here. The tab auth
    // wall doesn't cover this route — guard explicitly before /run/active.
    if (!profile?.id) {
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
    if (!profile?.id) {
      router.push('/auth');
      return;
    }
    tapLight();
    router.push({
      pathname: '/run/active',
      params: { trailId: trail.id, trailName: trail.name, intent: 'practice' },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 140 }]}
      >
        <TopBar onBack={goBack} title="Trasa" />

        {spotName ? (
          <Pressable onPress={goToSpot} style={styles.crumb} hitSlop={8}>
            <Text style={styles.crumbLabel}>BIKE PARK</Text>
            <View style={styles.crumbDot} />
            <Text style={styles.crumbName}>{spotName.toUpperCase()}</Text>
            <IconGlyph name="chevron-right" size={12} color={colors.accent} />
          </Pressable>
        ) : null}

        {/* ═════ HERO ═════ */}
        <View style={styles.hero}>
          <View style={styles.heroPillRow}>
            <Pill state="accent">Trasa</Pill>
          </View>
          <PageTitle title={trail.name} hero />

          <View style={styles.tagRow}>
            <DifficultyPill tone={tone} />
            <Pill state="neutral" size="xs">{trail.trailType}</Pill>
            {trail.seedSource && trail.trustTier
              ? <TrustBadge
                  seedSource={trail.seedSource}
                  trustTier={trail.trustTier}
                  confirmersCount={trail.uniqueConfirmingRidersCount}
                />
              : null}
          </View>

          {trail.pioneerUsername ? (
            <View style={styles.pioneerRow}>
              <PioneerBadge size="sm" />
              <Text style={styles.pioneerLabel}>PIONEER:</Text>
              <Text style={styles.pioneerName}>@{trail.pioneerUsername}</Text>
              {trail.pioneeredAt ? (
                <Text style={styles.pioneerDate}>· {formatPioneerDate(trail.pioneeredAt)}</Text>
              ) : null}
            </View>
          ) : null}

          {isTrainingOnly ? (
            <Pill state="pending" size="sm">Walidacja treningowa</Pill>
          ) : null}
        </View>

        {/* ═════ STATS GRID ═════ */}
        <View style={styles.statsGrid}>
          <StatBox label="Długość" value={`${trail.distanceM}`} unit="m" style={{ flex: 1 }} />
          <StatBox label="Spadek" value={`${trail.elevationDropM}`} unit="m ↓" style={{ flex: 1 }} />
          <StatBox
            label="Twój PB"
            value={myStats?.pbMs ? formatTime(myStats.pbMs) : '—'}
            accent={!!myStats?.pbMs}
            style={{ flex: 1 }}
          />
        </View>

        {/* ═════ TRUST DISCLOSURE BANNER (GPT Rule 2) ═════ */}
        {trail.seedSource && trail.trustTier ? (
          <View style={styles.trustBanner}>
            <IconGlyph name="verified" size={14} color={colors.accent} />
            <Text style={styles.trustText}>
              {getTrustDisclosure(
                trail.seedSource,
                trail.trustTier,
                trail.uniqueConfirmingRidersCount,
              )}
            </Text>
          </View>
        ) : null}

        {/* ═════ STATUS CARD ═════
            Tabs are auth-walled so isAuthenticated is always true here.
            Authenticated user with no PB on this trail falls through to
            the "BEZ WYNIKU NA TEJ TRASIE" card below. */}
        {myEntry ? (
            <HudPanel
              title="Twoja pozycja"
              status={
                tierLabel ? (
                  <Pill state={tierLabel === 'PODIUM' ? 'accent' : 'verified'} size="sm">
                    {tierLabel}
                  </Pill>
                ) : null
              }
              accent
            >
              <View style={styles.statusRow}>
                <View>
                  <Text style={styles.statusPos}>#{String(myPos).padStart(2, '0')}</Text>
                  <Text style={styles.statusPosLabel}>
                    {boardScope === 'day'
                      ? 'POZYCJA · DZIŚ'
                      : boardScope === 'weekend'
                        ? 'POZYCJA · WEEKEND'
                        : 'POZYCJA · WSZECHCZASÓW'}
                  </Text>
                </View>
                <View style={styles.statusRight}>
                  <Text style={styles.statusPbLabel}>TWÓJ REKORD</Text>
                  <Text style={styles.statusPb}>
                    {myStats?.pbMs ? formatTime(myStats.pbMs) : '—'}
                  </Text>
                </View>
              </View>
              {nearestRival ? (
                <View style={styles.rivalRow}>
                  <Text style={styles.rivalLabel}>
                    CEL: #{nearestRival.currentPosition} {nearestRival.username}
                  </Text>
                  <Text style={styles.rivalGap}>
                    {((myEntry.bestDurationMs - nearestRival.bestDurationMs) / 1000).toFixed(1)}s
                  </Text>
                </View>
              ) : null}
              {placesToNextTier > 0 && placesToNextTier <= 7 ? (
                <Text style={styles.ambition}>
                  {placesToNextTier === 1 ? '1 pozycja' : `${placesToNextTier} pozycji`} do {myPos > 10 ? 'TOP 10' : 'podium'}
                </Text>
              ) : null}
            </HudPanel>
          ) : (
            <Card>
              <View style={styles.noResultRow}>
                <IconGlyph name="timer" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.noResultTitle}>BEZ WYNIKU NA TEJ TRASIE</Text>
                  <Text style={styles.noResultHint}>
                    Ukończ zjazd aby pojawić się na tablicy.
                  </Text>
                </View>
              </View>
            </Card>
          )}

        {/* ═════ BOARD SECTION ═════ */}
        <View style={styles.section}>
          <SectionHead
            icon="podium"
            label="Ranking"
            count={leaderboard.length || null}
            action={
              leaderboard.length > 5 ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/leaderboard',
                      params: { trailId: trail.id, scope: boardScope },
                    })
                  }
                >
                  <Text style={styles.boardMore}>PEŁNA ↗</Text>
                </Pressable>
              ) : undefined
            }
          />

          <View style={styles.scopeTabs}>
            {SCOPE_TABS.map(([key, label]) => {
              const active = boardScope === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    tapLight();
                    setBoardScope(key);
                  }}
                  style={[styles.scopeTab, active && styles.scopeTabActive]}
                >
                  <Text style={[styles.scopeTabText, active && styles.scopeTabTextActive]}>
                    {label.toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {lbLoading ? (
            <ActivityIndicator color={colors.accent} style={{ paddingVertical: spacing.lg }} />
          ) : null}

          {!lbLoading && lbStatus === 'error' ? (
            <View style={styles.boardEmpty}>
              <Text style={styles.emptyText}>NIE UDAŁO SIĘ ZAŁADOWAĆ TABLICY</Text>
              <Btn variant="ghost" size="sm" fullWidth={false} onPress={() => lbRefresh()}>
                Ponów
              </Btn>
            </View>
          ) : null}

          {!lbLoading && lbStatus !== 'error' && top5.length === 0 ? (
            <View style={styles.boardEmpty}>
              <Text style={styles.emptyText}>RANKING PUSTY</Text>
              <Text style={styles.emptyHint}>Postaw pierwszy czas.</Text>
            </View>
          ) : null}

          {top5.map((entry) => (
            <Pressable
              key={entry.userId}
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
              <LeaderboardRow
                position={entry.currentPosition}
                rider={entry.username}
                time={formatTimeShort(entry.bestDurationMs)}
                self={entry.isCurrentUser}
                leading={entry.userId === trail.pioneerUserId ? <PioneerBadge size="sm" /> : undefined}
              />
            </Pressable>
          ))}

          {myEntry && myEntry.currentPosition > 5 ? (
            <>
              <Text style={styles.dotsBetween}>···</Text>
              <LeaderboardRow
                position={myEntry.currentPosition}
                rider={myEntry.username}
                time={formatTimeShort(myEntry.bestDurationMs)}
                self
              />
            </>
          ) : null}
        </View>

        {canDeleteTrail ? (
          <Pressable onPress={handleDeleteTrail} hitSlop={12} style={styles.deleteLink}>
            <Text style={styles.deleteLinkText}>Usuń tę trasę</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {/* ═════ ACTION BAR ═════
        Trening button is hidden when ranking is available — riders
        kept tapping the secondary "Trening" CTA by accident on smaller
        screens and ending up in a non-counted run. We surface practice
        only on training-only venues, where it's the ONLY way to ride
        the trail (ranking is gated until the venue gets a canonical
        version). For ranked-capable trails, one obvious primary CTA. */}
      <View style={styles.actionBar}>
        {isTrainingOnly ? (
          <Btn
            variant="primary"
            size="lg"
            onPress={handleStartPractice}
            style={{ flex: 1 }}
          >
            Trening
          </Btn>
        ) : (
          <Btn
            variant="primary"
            size="lg"
            onPress={handleStartRanked}
            icon={<IconGlyph name="lock" size={16} color={colors.accentInk} />}
            style={{ flex: 1 }}
          >
            Jedź ranking
          </Btn>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: spacing.pad,
    gap: spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.pad,
  },
  // Not-found state — Pattern 5: muted CAPS title + body + primary CTA.
  notFoundState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  notFoundTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.64,
    color: colors.textMuted,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  notFoundBody: {
    ...typography.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
    marginBottom: spacing.md,
  },
  errorTitle: {
    ...typography.label,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.64,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  // Crumb to spot
  crumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  crumbLabel: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2.0,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  crumbDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  crumbName: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.65,
    color: colors.accent,
    fontWeight: '700',
  },

  // Hero
  hero: {
    gap: 14,
    paddingTop: 4,
  },
  heroPillRow: {
    flexDirection: 'row',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  pioneerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  pioneerLabel: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 2.4,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  pioneerName: {
    ...typography.body,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: colors.accent,
    fontWeight: '700',
  },
  pioneerDate: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
  },

  // Trust banner
  trustBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 255, 135, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 135, 0.18)',
    borderRadius: 14,
    padding: 12,
  },
  trustText: {
    ...typography.body,
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },

  // Status (HudPanel interior)
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statusPos: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 56,
    lineHeight: 56,
    color: colors.accent,
    letterSpacing: -1.12, // -0.02em @ 56
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  statusPosLabel: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2.16, // 0.24em @ 9
    color: colors.textTertiary,
    fontWeight: '700',
    marginTop: 6,
  },
  statusRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusPbLabel: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2.16,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  statusPb: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 24,
    lineHeight: 24,
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -0.24,
  },
  rivalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rivalLabel: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: colors.textPrimary,
    letterSpacing: 1.32, // 0.12em @ 11
    fontWeight: '700',
  },
  rivalGap: {
    ...typography.delta,
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: colors.warn,
    fontVariant: ['tabular-nums'],
    fontWeight: '800',
  },
  ambition: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },

  // No-result card
  noResultRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  noResultTitle: {
    ...typography.label,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.64,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  noResultHint: {
    ...typography.body,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },

  // Board section
  section: {
    gap: 10,
  },
  boardMore: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    letterSpacing: 2.16,
    color: colors.accent,
    fontWeight: '800',
  },
  scopeTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  scopeTab: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scopeTabActive: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
  },
  scopeTabText: {
    ...typography.micro,
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    fontWeight: '700',
  },
  scopeTabTextActive: {
    color: colors.accent,
  },

  boardEmpty: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    ...typography.label,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.64,
    color: colors.textSecondary,
  },
  emptyHint: {
    ...typography.body,
    fontSize: 12,
    color: colors.textTertiary,
  },
  dotsBetween: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 18,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 4,
  },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.pad,
    paddingTop: 12,
    paddingBottom: 24,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  // Draft state
  draftCtaIcon: {
    alignSelf: 'flex-start',
  },
  draftCtaTitle: {
    ...typography.label,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.64,
    color: colors.accent,
    fontWeight: '800',
  },
  draftCtaBody: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  deleteLink: {
    alignSelf: 'center',
    paddingTop: 12,
  },
  deleteLinkText: {
    ...typography.body,
    fontSize: 13,
    color: colors.textTertiary,
  },
});
