import { useState, useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { selectionTick } from '@/systems/haptics';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailColor } from '@/theme/map';
import { getSpot } from '@/data/mock/spots';
import { getTrailsForSpot } from '@/data/mock/trails';
import { copy, formatTimeShort } from '@/content/copy';
import { useAuthContext } from '@/hooks/AuthContext';
import { useUserTrailStats, useChallenges } from '@/hooks/useBackend';
import { useVenueContext } from '@/hooks/useVenueContext';
import { TrailDrawer } from '@/components/map/TrailDrawer';
import type { StartReadiness, ReadinessLevel, GpsQuality } from '@/components/map/TrailDrawer';
import { ArenaMapWeb } from '@/components/map/ArenaMapWeb';
import { distanceMeters } from '@/systems/gps';
import { getVenue } from '@/data/venues';

// Custom SVG surface on native, web fallback on web
const ArenaMap = Platform.OS !== 'web'
  ? require('@/components/map/ArenaMapCustom').ArenaMapCustom
  : null;
import { Difficulty } from '@/data/types';

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { profile } = useAuthContext();
  const { stats: trailStatsMap } = useUserTrailStats(profile?.id);
  const spot = getSpot(id);
  const venue = id ? getVenue(id) : undefined;
  const { challenges } = useChallenges(spot?.id ?? id ?? '', profile?.id);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);
  const [highlightStart, setHighlightStart] = useState(false);
  const [focusTarget, setFocusTarget] = useState<'start' | 'rider' | 'both' | null>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live rider position + venue context ──
  const venueState = useVenueContext(true);
  const riderPosition = venueState.riderPosition;

  // ── Compute start readiness for selected trail ──
  const readiness = useMemo((): StartReadiness | undefined => {
    if (!selectedTrailId) return undefined;

    // GPS quality from accuracy
    const accuracy = riderPosition?.accuracy ?? null;
    const gpsQuality: GpsQuality =
      accuracy === null || accuracy === undefined ? 'none' :
      accuracy <= 10 ? 'excellent' :
      accuracy <= 25 ? 'good' : 'weak';

    if (!riderPosition) return { level: 'no_gps', distanceM: null, gpsQuality: 'none' };

    const geo = venue?.trailGeo.find((t) => t.trailId === selectedTrailId);
    if (!geo) return { level: 'no_gps', distanceM: null, gpsQuality };

    const dist = Math.round(distanceMeters(
      riderPosition,
      { latitude: geo.startZone.latitude, longitude: geo.startZone.longitude },
    ));

    // ── Outside venue: > 2 km = not at resort, > 5 km = different continent ──
    if (dist > 2000) {
      return { level: 'outside_venue', distanceM: null, gpsQuality };
    }

    // Tightened thresholds for mountain terrain:
    //   ready:       inside gate radius (25-30m) + decent GPS
    //   at_start:    ≤ 40m — close enough to see the gate
    //   approaching: ≤ 80m — walking distance, ~1 min
    //   too_far:     > 80m — need to move significantly
    let level: ReadinessLevel;
    if (dist <= geo.startZone.radiusM) {
      level = gpsQuality !== 'weak' ? 'ready' : 'at_start'; // weak GPS → don't promise "ready"
    } else if (dist <= 40) {
      level = 'at_start';
    } else if (dist <= 80) {
      level = 'approaching';
    } else {
      level = 'too_far';
    }

    return { level, distanceM: dist, gpsQuality };
  }, [selectedTrailId, riderPosition]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [navigation, router]);

  const handleTrailSelect = useCallback((trailId: string) => {
    selectionTick();
    setSelectedTrailId(trailId);
  }, []);

  const handleMapPress = useCallback(() => {
    setSelectedTrailId(null);
  }, []);

  if (!spot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={{ color: colors.textTertiary, fontSize: 13 }}>
            Spot nie znaleziony
          </Text>
          <Pressable onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backText}>← WRÓĆ</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const trails = getTrailsForSpot(spot.id);
  const selectedTrail = trails.find((t) => t.id === selectedTrailId);
  const selectedStats = selectedTrailId
    ? trailStatsMap.get(selectedTrailId)
    : undefined;

  return (
    <View style={styles.container}>
      {/* Floating header overlay */}
      <SafeAreaView style={styles.headerOverlay} edges={['top']}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.seasonLabel}>SEZON 01</Text>
            <Text style={styles.spotTitle}>{spot.name}</Text>
          </View>
          <View style={styles.ridersTag}>
            <Text style={styles.ridersCount}>S01</Text>
            <Text style={styles.ridersLabel}>LIGA</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Training-only banner for unranked venues */}
      {venue && !venue.rankingEnabled && (
        <View style={styles.trainingBanner}>
          <Text style={styles.trainingBannerText}>
            TRYB WALIDACJI · TRASY W WERYFIKACJI
          </Text>
        </View>
      )}

      {/* Full-screen map */}
      {Platform.OS !== 'web' && ArenaMap && venue ? (
        <ArenaMap
          venue={venue}
          trails={trails}
          selectedTrailId={selectedTrailId}
          hotTrailId={venue.trails[venue.trails.length - 1]?.id}
          challengeTrailId={venue.trails[venue.trails.length - 1]?.id}
          riderPosition={riderPosition}
          highlightStart={highlightStart}
          focusTarget={focusTarget}
          onTrailSelect={handleTrailSelect}
          onMapPress={() => {
            handleMapPress();
            setFocusTarget(null);
          }}
        />
      ) : (
        <ArenaMapWeb
          trails={trails}
          selectedTrailId={selectedTrailId}
          hotTrailId={venue?.trails[venue.trails.length - 1]?.id}
          challengeTrailId={venue?.trails[venue.trails.length - 1]?.id}
          trailStats={trailStatsMap}
          onTrailSelect={handleTrailSelect}
          onMapPress={handleMapPress}
        />
      )}

      {/* Trail list strip at bottom (when no trail selected) */}
      {!selectedTrail && (
        <View style={styles.trailStrip}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.trailStripContent}
          >
            {trails.map((trail) => {
              const stats = trailStatsMap.get(trail.id);
              const official = venue?.trails.find((o) => o.id === trail.id);
              const diffColor = getTrailColor(official?.colorClass, trail.difficulty);

              return (
                <Pressable
                  key={trail.id}
                  style={({ pressed }) => [
                    styles.trailChip,
                    { borderLeftWidth: 2.5, borderLeftColor: diffColor },
                    pressed && { backgroundColor: 'rgba(255,255,255,0.06)', transform: [{ scale: 0.97 }] },
                  ]}
                  onPress={() => handleTrailSelect(trail.id)}
                >
                  <View style={styles.trailChipHeader}>
                    <Text style={styles.trailChipName}>{trail.name}</Text>
                  </View>
                  <Text style={styles.trailChipMeta}>
                    {trail.difficulty.toUpperCase()} · {trail.trailType}
                  </Text>
                  {stats?.pbMs && (
                    <Text style={styles.trailChipPb}>
                      PB {formatTimeShort(stats.pbMs)}
                    </Text>
                  )}
                  {!stats?.pbMs && (
                    <Text style={styles.trailChipNoPb}>Brak PB</Text>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Selected trail drawer */}
      {selectedTrail && (
        <TrailDrawer
          trail={selectedTrail}
          stats={selectedStats}
          challenges={challenges}
          readiness={readiness}
          rankingEnabled={venue?.rankingEnabled ?? false}
          colorClass={venue?.trails.find((t) => t.id === selectedTrail.id)?.colorClass}
          onShowStart={() => {
            selectionTick();
            setHighlightStart(true);
            // Smart: if rider has GPS, show both rider + start together
            setFocusTarget(riderPosition ? 'both' : 'start');
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
            focusTimerRef.current = setTimeout(() => {
              setHighlightStart(false);
              setFocusTarget(null);
            }, 5000);
          }}
          onShowRider={() => {
            selectionTick();
            setFocusTarget('rider');
            if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
            focusTimerRef.current = setTimeout(() => {
              setFocusTarget(null);
            }, 5000);
          }}
          onClose={handleMapPress}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Training banner
  trainingBanner: {
    position: 'absolute' as const,
    top: 100, // below header
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 5,
    backgroundColor: 'rgba(255, 149, 0, 0.12)',
    borderRadius: radii.sm,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    alignItems: 'center' as const,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 149, 0, 0.20)',
  },
  trainingBannerText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 8,
    color: 'rgba(255, 149, 0, 0.70)',
    letterSpacing: 2,
  },

  // Floating header
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.bgOverlay,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    ...typography.body,
    color: colors.textPrimary,
    fontSize: 18,
  },
  headerCenter: {
    flex: 1,
  },
  seasonLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  spotTitle: {
    ...typography.h3,
    color: colors.textPrimary,
  },
  ridersTag: {
    backgroundColor: colors.accentDim,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    alignItems: 'center',
  },
  ridersCount: {
    ...typography.h3,
    color: colors.accent,
    fontSize: 16,
  },
  ridersLabel: {
    ...typography.labelSmall,
    color: colors.accent,
    fontSize: 8,
    letterSpacing: 2,
  },

  // Trail strip (horizontal scroll at bottom)
  trailStrip: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 34, // iPhone safe area
    backgroundColor: 'transparent',
  },
  trailStripContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  trailChip: {
    backgroundColor: 'rgba(10, 10, 18, 0.75)',
    borderRadius: radii.sm + 2,
    paddingHorizontal: 9,
    paddingVertical: 6,
    minWidth: 110,
    maxWidth: 160,
    borderWidth: 0,
  },
  trailChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 1,
  },
  trailChipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  trailChipName: {
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
  },
  trailChipMeta: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.30)',
    fontSize: 7.5,
    letterSpacing: 0.3,
    marginBottom: 1,
  },
  trailChipPb: {
    fontFamily: 'Inter_500Medium',
    color: colors.accent,
    fontSize: 8.5,
    letterSpacing: 0.5,
    opacity: 0.9,
  },
  trailChipNoPb: {
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255, 255, 255, 0.30)',
    fontSize: 8.5,
  },
});
