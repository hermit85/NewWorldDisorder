// ═══════════════════════════════════════════════════════════
// Spot detail — Ye brutalist rebuild (ADR-013).
//
// Structure:
//   1. Top bar: back ← + 'OŚRODEK' mono
//   2. Title: spot name serif 42pt + 'REGION · DIST od WARSZAWY' mono
//   3. Stats row (hairline top): TRASY N / TWOJE N / RIDERS N
//   4. Trail list: rows with rank number + serif name + ⚡ + meta
//      + TrustBadge + TWÓJ PB right-aligned (or 'BEZ CZASU')
//   5. CTA: 'WYBIERZ TRASĘ I ZJEDŹ' (cream outline, scrolls to trails)
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tapLight } from '@/systems/haptics';
import { hudColors, hudType, hudSpacing } from '@/theme/gameHud';
import {
  useSpot, useTrails, useDeleteSpot, useUserTrailStats,
} from '@/hooks/useBackend';
import { useAuthContext } from '@/hooks/AuthContext';
import { formatTimeShort } from '@/content/copy';
import { TrustBadge } from '@/components/game/TrustBadge';
import { PioneerBadge } from '@/components/game/PioneerBadge';

const HAIRLINE = StyleSheet.hairlineWidth;

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuthContext();

  const { spot } = useSpot(id ?? null);
  const { trails, status: trailsStatus } = useTrails(id ?? null);
  const { stats: trailStatsMap } = useUserTrailStats(profile?.id);
  const { submit: deleteSpot } = useDeleteSpot();
  const isCurator = profile?.role === 'curator' || profile?.role === 'moderator';

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) router.back();
    else router.replace('/');
  }, [navigation, router]);

  const handleAddTrail = useCallback(() => {
    if (!id) return;
    tapLight();
    router.push(`/trail/new?spotId=${id}`);
  }, [id, router]);

  const handleTrailPress = useCallback((trailId: string) => {
    tapLight();
    router.push(`/trail/${trailId}`);
  }, [router]);

  const handleDelete = useCallback(() => {
    if (!spot) return;
    Alert.alert(
      `Usunąć bike park ${spot.name}?`,
      'Wszystkie trasy, czasy i wyzwania zostaną usunięte.',
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteSpot(spot.id);
            if (result.ok) goBack();
            else Alert.alert(`Nie udało się: ${result.code}`, result.message ?? '');
          },
        },
      ],
    );
  }, [spot, deleteSpot, goBack]);

  // Rider stats summary
  const { yoursCount } = useMemo(() => {
    let count = 0;
    trails.forEach((t) => {
      const s = trailStatsMap.get(t.id);
      if (s?.pbMs != null) count += 1;
    });
    return { yoursCount: count };
  }, [trails, trailStatsMap]);

  if (!spot && trailsStatus !== 'loading') {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBar label="OŚRODEK" onBack={goBack} />
        <View style={styles.center}>
          <Text style={styles.emptyBody}>Bike park nie znaleziony</Text>
        </View>
      </SafeAreaView>
    );
  }
  if (!spot) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopBar label="OŚRODEK" onBack={goBack} />
        <View style={styles.center}>
          <ActivityIndicator color={hudColors.signal} />
        </View>
      </SafeAreaView>
    );
  }

  const statusText =
    spot.submissionStatus === 'pending'  ? 'OCZEKUJE' :
    spot.submissionStatus === 'rejected' ? 'ODRZUCONY' : 'AKTYWNY';
  const statusColor =
    spot.submissionStatus === 'pending'  ? hudColors.trust.curator :
    spot.submissionStatus === 'rejected' ? hudColors.trust.disputed :
    hudColors.signal;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TopBar
          label="OŚRODEK"
          onBack={goBack}
          rightLabel={isCurator ? '⋯' : undefined}
          onRight={isCurator ? handleDelete : undefined}
        />

        {/* Title */}
        <View style={styles.titleBlock}>
          <Text style={styles.spotName}>{spot.name}</Text>
          <Text style={styles.spotMeta}>
            {spot.region.toUpperCase()}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusLabel, { color: statusColor }]}>{statusText}</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <Stat label="TRASY" value={String(trails.length).padStart(2, '0')} />
          <Stat label="TWOJE" value={String(yoursCount).padStart(2, '0')} emphasised={yoursCount > 0} />
          <Stat label="RIDERS" value="—" />
        </View>

        {/* Trail list */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.kicker}>{`TRASY / ${String(trails.length).padStart(2, '0')}`}</Text>
            <Pressable onPress={handleAddTrail} hitSlop={8}>
              <Text style={styles.sectionLink}>+ DODAJ TRASĘ</Text>
            </Pressable>
          </View>

          {trailsStatus === 'loading' && (
            <ActivityIndicator color={hudColors.signal} style={{ paddingVertical: hudSpacing.xxl }} />
          )}

          {trailsStatus !== 'loading' && trails.length === 0 && (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyHero}>Czeka na pierwszego Pioniera</Text>
              <Text style={styles.emptyBody}>
                Zgłoś trasę i zjedź ją jako pierwszy — twoje imię zostanie zapisane na zawsze.
              </Text>
              <Pressable
                onPress={handleAddTrail}
                style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
              >
                <Text style={styles.ctaLabel}>DODAJ PIERWSZĄ TRASĘ</Text>
              </Pressable>
            </View>
          )}

          {trails.map((trail, index) => {
            const stat = trailStatsMap.get(trail.id);
            const hasPb = stat?.pbMs != null;
            return (
              <Pressable
                key={trail.id}
                onPress={() => handleTrailPress(trail.id)}
                style={({ pressed }) => [
                  styles.trailRow,
                  index > 0 && styles.trailRowDivider,
                  pressed && styles.trailRowPressed,
                ]}
              >
                <Text style={styles.trailRank}>{String(index + 1).padStart(2, '0')}</Text>

                <View style={styles.trailMain}>
                  <View style={styles.trailNameRow}>
                    <Text style={styles.trailName} numberOfLines={1}>{trail.name}</Text>
                    {trail.pioneerUserId && <PioneerBadge size="sm" />}
                  </View>
                  <Text style={styles.trailSub}>
                    {`${trail.difficulty.toUpperCase()} · ${trail.trailType.toUpperCase()} · ${(trail.distanceM / 1000).toFixed(1)} KM · ${trail.elevationDropM} M ▼`}
                  </Text>
                  {trail.seedSource && trail.trustTier && (
                    <View style={styles.trustRow}>
                      <TrustBadge seedSource={trail.seedSource} trustTier={trail.trustTier} size="sm" />
                    </View>
                  )}
                </View>

                <View style={styles.trailRight}>
                  {hasPb ? (
                    <>
                      <Text style={styles.pbLabel}>TWÓJ PB</Text>
                      <Text style={styles.pbTime}>{formatTimeShort(stat!.pbMs!)}</Text>
                      {stat?.position != null && stat.position > 0 && (
                        <Text style={styles.pbRank}>{`#${stat.position}`}</Text>
                      )}
                    </>
                  ) : (
                    <>
                      <Text style={styles.pbLabel}>BEZ CZASU</Text>
                      <Text style={styles.pbEmpty}>nie zjechałeś</Text>
                    </>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>

        {trails.length > 0 && (
          <Pressable
            onPress={() => handleTrailPress(trails[0].id)}
            style={({ pressed }) => [styles.cta, styles.ctaFooter, pressed && styles.ctaPressed]}
          >
            <Text style={styles.ctaLabel}>WYBIERZ TRASĘ I ZJEDŹ</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Subcomponents ────────────────────────────────────────

function TopBar({
  label, onBack, rightLabel, onRight,
}: {
  label: string;
  onBack: () => void;
  rightLabel?: string;
  onRight?: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={styles.topSide}>←</Text>
      </Pressable>
      <Text style={styles.topCenter}>{label}</Text>
      {rightLabel && onRight ? (
        <Pressable onPress={onRight} hitSlop={12}>
          <Text style={styles.topSide}>{rightLabel}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 24 }} />
      )}
    </View>
  );
}

function Stat({ label, value, emphasised }: { label: string; value: string; emphasised?: boolean }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, emphasised && { color: hudColors.signal }]}>{value}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: hudColors.surface.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: hudSpacing.xxl },
  scroll: { paddingBottom: hudSpacing.giant },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: hudSpacing.xxl,
    paddingVertical: hudSpacing.md,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: hudColors.surface.border,
  },
  topSide: {
    ...hudType.label,
    color: hudColors.text.secondary,
    minWidth: 24,
  },
  topCenter: {
    ...hudType.labelSm,
    color: hudColors.text.secondary,
    flex: 1,
    textAlign: 'center',
  },

  titleBlock: {
    paddingHorizontal: hudSpacing.xxl,
    paddingTop: hudSpacing.mega,
  },
  spotName: {
    ...hudType.heroCopy,
    color: hudColors.text.primary,
    fontSize: 42,
    lineHeight: 46,
  },
  spotMeta: {
    ...hudType.caption,
    color: hudColors.text.secondary,
    marginTop: hudSpacing.sm,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: hudSpacing.md,
  },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusLabel: { ...hudType.labelSm },

  statsRow: {
    flexDirection: 'row',
    marginTop: hudSpacing.xxxl,
    paddingHorizontal: hudSpacing.xxl,
    paddingTop: hudSpacing.xxl,
    borderTopWidth: HAIRLINE,
    borderTopColor: hudColors.surface.border,
  },
  statCol: { flex: 1 },
  statLabel: {
    ...hudType.labelSm,
    color: hudColors.text.secondary,
    marginBottom: hudSpacing.xs,
  },
  statValue: {
    ...hudType.displayMd,
    color: hudColors.text.primary,
    fontSize: 24,
    lineHeight: 28,
    fontVariant: ['tabular-nums'],
  },

  section: {
    paddingHorizontal: hudSpacing.xxl,
    paddingTop: hudSpacing.xxxl,
    marginTop: hudSpacing.xxxl,
    borderTopWidth: HAIRLINE,
    borderTopColor: hudColors.surface.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hudSpacing.lg,
  },
  kicker: {
    ...hudType.label,
    color: hudColors.text.secondary,
  },
  sectionLink: {
    ...hudType.labelSm,
    color: hudColors.signal,
  },

  // Empty
  emptyBlock: {
    paddingVertical: hudSpacing.xxl,
  },
  emptyHero: {
    ...hudType.displayMd,
    color: hudColors.text.primary,
    marginBottom: hudSpacing.md,
  },
  emptyBody: {
    ...hudType.body,
    color: hudColors.text.secondary,
    lineHeight: 18,
  },

  // Trail row
  trailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: hudSpacing.lg,
    gap: hudSpacing.md,
  },
  trailRowDivider: {
    borderTopWidth: HAIRLINE,
    borderTopColor: hudColors.surface.border,
  },
  trailRowPressed: { opacity: 0.75 },
  trailRank: {
    ...hudType.stat,
    color: hudColors.text.muted,
    width: 28,
    marginTop: 3,
  },
  trailMain: { flex: 1 },
  trailNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: hudSpacing.sm,
  },
  trailName: {
    ...hudType.displaySm,
    color: hudColors.text.primary,
    flexShrink: 1,
  },
  trailSub: {
    ...hudType.captionSm,
    color: hudColors.text.secondary,
    marginTop: hudSpacing.xs,
    letterSpacing: 1.5,
  },
  trustRow: {
    marginTop: hudSpacing.sm,
  },
  trailRight: {
    alignItems: 'flex-end',
    minWidth: 72,
    marginTop: 3,
  },
  pbLabel: {
    ...hudType.labelSm,
    color: hudColors.text.secondary,
    fontSize: 8,
  },
  pbTime: {
    ...hudType.statLg,
    color: hudColors.text.primary,
    marginTop: 2,
  },
  pbRank: {
    ...hudType.captionSm,
    color: hudColors.signal,
    marginTop: 2,
  },
  pbEmpty: {
    ...hudType.displayXs,
    color: hudColors.text.muted,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 2,
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
  ctaFooter: {
    marginTop: hudSpacing.giant,
  },
  ctaPressed: { backgroundColor: hudColors.text.primary },
  ctaLabel: {
    ...hudType.label,
    color: hudColors.text.primary,
  },
});
