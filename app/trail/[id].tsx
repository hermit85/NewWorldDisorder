// ═══════════════════════════════════════════════════════════
// Trail detail — Ye brutalist rebuild (ADR-013).
//
// Structure:
//   1. Top bar: back ← + 'SŁOTWINY / 01 OF 04' + curator ⋯
//   2. Title section: 'TRASA' kicker + trail name serif 64pt +
//      meta row (difficulty·type·km·drop) + TrustBadge row
//   3. Pioneer section (if pioneered)
//   4. Your PB section (if user has time)
//   5. Rywal section (rival above)
//   6. Tablica section (top-5 + highlighted user row)
//   7. CTA: 'ZJEDŹ JESZCZE RAZ' cream outline
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hudColors, hudType, hudSpacing } from '@/theme/gameHud';
import { useTrail, useSpot, useDeleteTrail, useTrails, useLeaderboard, useUserTrailStats } from '@/hooks/useBackend';
import { useAuthContext } from '@/hooks/AuthContext';
import { formatTime, formatTimeShort } from '@/content/copy';
import { tapMedium, tapLight } from '@/systems/haptics';
import { TrustBadge } from '@/components/game/TrustBadge';
import { PioneerBadge } from '@/components/game/PioneerBadge';

const HAIRLINE = StyleSheet.hairlineWidth;

export default function TrailDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { profile, isAuthenticated } = useAuthContext();
  const { trail } = useTrail(id ?? null);
  const { spot } = useSpot(trail?.spotId ?? null);
  const { trails: siblingTrails } = useTrails(trail?.spotId ?? null);
  const isCurator = profile?.role === 'curator' || profile?.role === 'moderator';
  const { submit: deleteTrail } = useDeleteTrail();

  const { entries: leaderboard, loading: lbLoading } = useLeaderboard(id ?? '', 'all_time', profile?.id);
  const { stats: trailStats } = useUserTrailStats(profile?.id);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
  }, [navigation, router]);

  const handleDelete = useCallback(() => {
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
            else Alert.alert(`Nie udało się: ${result.code}`, result.message ?? '');
          },
        },
      ],
    );
  }, [trail, deleteTrail, goBack]);

  const positionInSpot = useMemo(() => {
    if (!trail || siblingTrails.length === 0) return { pos: 0, total: 0 };
    const ordered = [...siblingTrails].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = ordered.findIndex((t) => t.id === trail.id);
    return { pos: idx + 1, total: ordered.length };
  }, [trail, siblingTrails]);

  if (!trail) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator color={hudColors.signal} />
        </View>
      </SafeAreaView>
    );
  }

  // Draft (no pioneer) — single CTA to start recording
  if (trail.calibrationStatus === 'draft' && trail.geometryMissing) {
    const startRecording = () => {
      if (!isAuthenticated) { tapLight(); router.push('/auth'); return; }
      tapMedium();
      router.push(`/run/recording?trailId=${trail.id}&spotId=${trail.spotId}`);
    };
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <TopBar
            leftLabel="← WRÓĆ"
            onLeft={goBack}
            centerLabel={spot?.name ? `${spot.name.toUpperCase()} / DRAFT` : 'DRAFT'}
          />

          <View style={styles.titleBlock}>
            <Text style={styles.kicker}>TRASA</Text>
            <Text style={styles.trailName}>{trail.name}</Text>
            <Text style={styles.trailMeta}>
              {`${trail.difficulty.toUpperCase()} · ${trail.trailType.toUpperCase()} · CZEKA NA PIONIERA`}
            </Text>
          </View>

          <View style={styles.draftCopy}>
            <Text style={styles.draftHero}>Pierwszy zjazd zostaje{'\n'}na zawsze</Text>
            <Text style={styles.draftBody}>
              Twoja linia staje się kalibracją dla wszystkich kolejnych riderów.
              Jeździsz z powrotem? Twój czas trafia na tablicę.
            </Text>
          </View>

          <Pressable
            onPress={startRecording}
            style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaLabel}>ROZPOCZNIJ NAGRYWANIE</Text>
          </Pressable>

          {isCurator && (
            <Pressable onPress={handleDelete} hitSlop={12} style={styles.curatorDelete}>
              <Text style={styles.curatorDeleteLabel}>Usuń tę trasę</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Calibrated trail
  const myStat = trailStats.get(trail.id);
  const myEntry = leaderboard.find((e) => e.isCurrentUser);
  const rival = myEntry
    ? leaderboard.find((e) => e.currentPosition === myEntry.currentPosition - 1)
    : null;
  const deltaMs = myEntry && rival ? myEntry.bestDurationMs - rival.bestDurationMs : null;
  const top5 = leaderboard.slice(0, 5);

  const handleStart = () => {
    if (!isAuthenticated) { tapLight(); router.push('/auth'); return; }
    tapMedium();
    router.push({ pathname: '/run/active', params: { trailId: trail.id, trailName: trail.name } });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TopBar
          leftLabel="←"
          onLeft={goBack}
          centerLabel={
            spot?.name
              ? `${spot.name.toUpperCase()} / ${String(positionInSpot.pos).padStart(2, '0')} OF ${String(positionInSpot.total).padStart(2, '0')}`
              : 'TRASA'
          }
          rightLabel={isCurator ? '⋯' : undefined}
          onRight={isCurator ? handleDelete : undefined}
        />

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.kicker}>TRASA</Text>
          <Text style={styles.trailName}>{trail.name}</Text>
          <Text style={styles.trailMeta}>
            {`${trail.difficulty.toUpperCase()} · ${trail.trailType.toUpperCase()} · ${(trail.distanceM / 1000).toFixed(1)} KM · ${trail.elevationDropM} M ▼`}
          </Text>
          <View style={styles.trustRow}>
            <TrustBadge seedSource={trail.seedSource} trustTier={trail.trustTier} size="md" />
          </View>
        </View>

        {/* Pioneer section */}
        {trail.pioneerUsername && (
          <View style={styles.section}>
            <View style={styles.pioneerHeader}>
              <PioneerBadge size="sm" label />
              {trail.pioneeredAt && (
                <Text style={styles.pioneerDate}>{formatPioneerDate(trail.pioneeredAt)}</Text>
              )}
            </View>
            <Text style={styles.pioneerUsername}>@{trail.pioneerUsername}</Text>
          </View>
        )}

        {/* Your PB */}
        {myStat?.pbMs != null && (
          <View style={styles.section}>
            <Text style={styles.kicker}>TWÓJ PB</Text>
            <View style={styles.pbRow}>
              <Text style={styles.pbTime}>{formatPbTime(myStat.pbMs).main}</Text>
              <Text style={styles.pbMs}>.{formatPbTime(myStat.pbMs).tail}</Text>
            </View>
            <View style={styles.pbMeta}>
              <View style={styles.pbBadge}>
                <Text style={styles.pbBadgeLabel}>PB</Text>
              </View>
              {deltaMs != null && deltaMs < 0 && (
                <Text style={styles.pbDelta}>{`${(deltaMs / 1000).toFixed(2)}s`}</Text>
              )}
              <View style={styles.metaDot} />
              <Text style={styles.pbPosition}>
                {`#${myEntry?.currentPosition ?? '—'} / ${leaderboard.length}`}
              </Text>
            </View>
          </View>
        )}

        {/* Rywal */}
        {rival && deltaMs != null && deltaMs > 0 && (
          <View style={styles.section}>
            <Text style={styles.kicker}>RYWAL NAD TOBĄ</Text>
            <View style={styles.rivalRow}>
              <Text style={styles.rivalName} numberOfLines={1}>{rival.username}</Text>
              <Text style={styles.rivalDelta}>+{(deltaMs / 1000).toFixed(2)}s</Text>
            </View>
            <Text style={styles.rivalSub}>
              {`POZYCJA #${rival.currentPosition} · JEDNO PRZEJŚCIE DALEJ`}
            </Text>
          </View>
        )}

        {/* Tablica */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.kicker}>TABLICA / S01</Text>
            <Text style={[styles.kicker, { color: hudColors.signal }]}>TYLKO PB</Text>
          </View>

          {lbLoading && <ActivityIndicator color={hudColors.signal} style={{ paddingVertical: hudSpacing.lg }} />}

          {!lbLoading && top5.length === 0 && (
            <Text style={styles.emptyBoard}>Tablica pusta · Postaw pierwszy czas</Text>
          )}

          {top5.map((entry, i) => {
            const isUser = entry.isCurrentUser;
            const isPioneer = entry.userId === trail.pioneerUserId;
            return (
              <View
                key={entry.userId}
                style={[
                  styles.lbRow,
                  i > 0 && styles.lbRowDivider,
                  isUser && styles.lbRowUser,
                ]}
              >
                <Text style={styles.lbPos}>{String(entry.currentPosition).padStart(2, '0')}</Text>
                <View style={styles.lbNameCol}>
                  <View style={styles.lbNameRow}>
                    <Text style={[styles.lbName, isUser && styles.lbNameUser]} numberOfLines={1}>
                      {entry.username}
                    </Text>
                    {isPioneer && <PioneerBadge size="sm" />}
                  </View>
                </View>
                <Text style={[styles.lbTime, isUser && { color: hudColors.signal }]}>
                  {formatTimeShort(entry.bestDurationMs)}
                </Text>
              </View>
            );
          })}

          {myEntry && myEntry.currentPosition > 5 && (
            <View style={[styles.lbRow, styles.lbRowUser, styles.lbRowDivider]}>
              <Text style={styles.lbPos}>{String(myEntry.currentPosition).padStart(2, '0')}</Text>
              <View style={styles.lbNameCol}>
                <Text style={[styles.lbName, styles.lbNameUser]}>{myEntry.username}</Text>
              </View>
              <Text style={[styles.lbTime, { color: hudColors.signal }]}>
                {formatTimeShort(myEntry.bestDurationMs)}
              </Text>
            </View>
          )}
        </View>

        {/* CTA */}
        <Pressable
          onPress={handleStart}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaLabel}>
            {myStat?.pbMs != null ? 'ZJEDŹ JESZCZE RAZ' : 'ZJEDŹ PIERWSZY RAZ'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Top bar subcomponent ──────────────────────────────────

function TopBar({
  leftLabel, onLeft, centerLabel, rightLabel, onRight,
}: {
  leftLabel: string;
  onLeft: () => void;
  centerLabel: string;
  rightLabel?: string;
  onRight?: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onLeft} hitSlop={12}>
        <Text style={styles.topBarSide}>{leftLabel}</Text>
      </Pressable>
      <Text style={styles.topBarCenter} numberOfLines={1}>{centerLabel}</Text>
      {rightLabel && onRight ? (
        <Pressable onPress={onRight} hitSlop={12}>
          <Text style={styles.topBarSide}>{rightLabel}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
    </View>
  );
}

// ── Helpers ───────────────────────────────────────────────

function formatPbTime(ms: number): { main: string; tail: string } {
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10);
  const main = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  const tail = String(hundredths).padStart(2, '0');
  return { main, tail };
}

function formatPioneerDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const months = ['STY','LUT','MAR','KWI','MAJ','CZE','LIP','SIE','WRZ','PAŹ','LIS','GRU'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hudColors.surface.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: {
    paddingHorizontal: hudSpacing.xxl,
    paddingBottom: hudSpacing.giant,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hudSpacing.md,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: hudColors.surface.border,
  },
  topBarSide: {
    ...hudType.label,
    color: hudColors.text.secondary,
    minWidth: 24,
  },
  topBarCenter: {
    ...hudType.labelSm,
    color: hudColors.text.secondary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: hudSpacing.md,
  },

  titleBlock: {
    paddingTop: hudSpacing.mega,
  },
  kicker: {
    ...hudType.label,
    color: hudColors.text.secondary,
    marginBottom: hudSpacing.sm,
  },
  trailName: {
    ...hudType.heroTrail,
    color: hudColors.text.primary,
  },
  trailMeta: {
    ...hudType.caption,
    color: hudColors.text.secondary,
    marginTop: hudSpacing.sm,
    letterSpacing: 1.5,
  },
  trustRow: {
    marginTop: hudSpacing.md,
  },

  // Draft state copy
  draftCopy: {
    paddingTop: hudSpacing.mega,
  },
  draftHero: {
    ...hudType.heroCopy,
    color: hudColors.text.primary,
  },
  draftBody: {
    ...hudType.body,
    color: hudColors.text.secondary,
    marginTop: hudSpacing.lg,
    lineHeight: 18,
  },

  // Sections
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

  // Pioneer section
  pioneerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hudSpacing.xs,
  },
  pioneerDate: {
    ...hudType.captionSm,
    color: hudColors.text.secondary,
  },
  pioneerUsername: {
    ...hudType.displaySm,
    color: hudColors.text.primary,
    fontSize: 20,
    marginTop: hudSpacing.xs,
  },

  // PB section
  pbRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: hudSpacing.sm,
  },
  pbTime: {
    ...hudType.heroTime,
    color: hudColors.text.primary,
  },
  pbMs: {
    ...hudType.displayMd,
    color: hudColors.text.muted,
    fontSize: 32,
    lineHeight: 36,
    marginLeft: 4,
    fontVariant: ['tabular-nums'],
  },
  pbMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hudSpacing.sm,
    marginTop: hudSpacing.md,
  },
  pbBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: hudColors.signalMuted,
    borderWidth: HAIRLINE,
    borderColor: hudColors.signal,
  },
  pbBadgeLabel: {
    ...hudType.labelSm,
    color: hudColors.signal,
    fontSize: 8,
  },
  pbDelta: {
    ...hudType.stat,
    color: hudColors.signal,
  },
  metaDot: {
    width: 3, height: 3, borderRadius: 2,
    backgroundColor: hudColors.text.muted,
  },
  pbPosition: {
    ...hudType.stat,
    color: hudColors.text.secondary,
  },

  // Rywal
  rivalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: hudSpacing.xs,
  },
  rivalName: {
    ...hudType.displaySm,
    color: hudColors.text.primary,
    flex: 1,
    paddingRight: hudSpacing.md,
  },
  rivalDelta: {
    ...hudType.displayMd,
    color: hudColors.signal,
    fontSize: 28,
    fontVariant: ['tabular-nums'],
  },
  rivalSub: {
    ...hudType.captionSm,
    color: hudColors.text.secondary,
    marginTop: hudSpacing.sm,
  },

  // Leaderboard
  emptyBoard: {
    ...hudType.body,
    color: hudColors.text.muted,
    textAlign: 'center',
    paddingVertical: hudSpacing.xxl,
  },
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hudSpacing.md,
  },
  lbRowDivider: {
    borderTopWidth: HAIRLINE,
    borderTopColor: hudColors.surface.border,
  },
  lbRowUser: {
    backgroundColor: hudColors.signalMuted,
    marginHorizontal: -hudSpacing.xxl,
    paddingHorizontal: hudSpacing.xxl,
    borderTopWidth: HAIRLINE,
    borderBottomWidth: HAIRLINE,
    borderTopColor: hudColors.signal,
    borderBottomColor: hudColors.signal,
  },
  lbPos: {
    ...hudType.stat,
    color: hudColors.text.secondary,
    width: 24,
  },
  lbNameCol: {
    flex: 1,
    paddingHorizontal: hudSpacing.md,
  },
  lbNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hudSpacing.xs,
  },
  lbName: {
    ...hudType.displayXs,
    color: hudColors.text.primary,
    fontSize: 16,
    flexShrink: 1,
  },
  lbNameUser: {
    color: hudColors.signal,
  },
  lbTime: {
    ...hudType.stat,
    color: hudColors.text.primary,
  },

  // CTA
  cta: {
    marginTop: hudSpacing.giant,
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
  },

  curatorDelete: {
    marginTop: hudSpacing.xxl,
    alignSelf: 'center',
    paddingVertical: hudSpacing.sm,
  },
  curatorDeleteLabel: {
    ...hudType.labelSm,
    color: hudColors.trust.disputed,
    textDecorationLine: 'underline',
  },
});
