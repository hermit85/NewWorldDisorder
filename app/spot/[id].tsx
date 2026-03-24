import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { trailLineColors } from '@/theme/map';
import { getSpot } from '@/data/mock/spots';
import { getTrailsForSpot } from '@/data/mock/trails';
import { getUserTrailStats } from '@/data/mock/userTrailStats';
import { copy, formatTimeShort } from '@/content/copy';
import { TrailDrawer } from '@/components/map/TrailDrawer';
import { ArenaMapWeb } from '@/components/map/ArenaMapWeb';

// Only import native map on native platforms
const ArenaMap = Platform.OS !== 'web'
  ? require('@/components/map/ArenaMap').ArenaMap
  : null;
import { Difficulty } from '@/data/types';

export default function SpotScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const spot = getSpot(id);
  const [selectedTrailId, setSelectedTrailId] = useState<string | null>(null);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [navigation, router]);

  const handleTrailSelect = useCallback((trailId: string) => {
    setSelectedTrailId(trailId);
  }, []);

  const handleMapPress = useCallback(() => {
    setSelectedTrailId(null);
  }, []);

  if (!spot) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ color: colors.textPrimary, padding: spacing.lg }}>
          Spot not found
        </Text>
      </SafeAreaView>
    );
  }

  const trails = getTrailsForSpot(spot.id);
  const selectedTrail = trails.find((t) => t.id === selectedTrailId);
  const selectedStats = selectedTrailId
    ? getUserTrailStats(selectedTrailId)
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
            <Text style={styles.seasonLabel}>SEASON 01</Text>
            <Text style={styles.spotTitle}>{spot.name}</Text>
          </View>
          <View style={styles.ridersTag}>
            <Text style={styles.ridersCount}>
              {spot.activeRidersToday}
            </Text>
            <Text style={styles.ridersLabel}>LIVE</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* Full-screen map */}
      {Platform.OS !== 'web' && ArenaMap ? (
        <ArenaMap
          trails={trails}
          selectedTrailId={selectedTrailId}
          hotTrailId="dzida-czerwona"
          challengeTrailId="dzida-czerwona"
          onTrailSelect={handleTrailSelect}
          onMapPress={handleMapPress}
        />
      ) : (
        <ArenaMapWeb
          trails={trails}
          selectedTrailId={selectedTrailId}
          hotTrailId="dzida-czerwona"
          challengeTrailId="dzida-czerwona"
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
              const stats = getUserTrailStats(trail.id);
              const diffColor = trailLineColors[trail.difficulty];

              return (
                <Pressable
                  key={trail.id}
                  style={styles.trailChip}
                  onPress={() => handleTrailSelect(trail.id)}
                >
                  <View style={styles.trailChipHeader}>
                    <View
                      style={[styles.trailChipDot, { backgroundColor: diffColor }]}
                    />
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
                    <Text style={styles.trailChipNoPb}>No PB yet</Text>
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
    paddingBottom: spacing.xxl,
    backgroundColor: 'transparent',
  },
  trailStripContent: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  trailChip: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.md,
    minWidth: 140,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trailChipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xxs,
  },
  trailChipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  trailChipName: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  trailChipMeta: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    marginBottom: spacing.xxs,
  },
  trailChipPb: {
    ...typography.labelSmall,
    color: colors.accent,
    fontSize: 10,
  },
  trailChipNoPb: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 10,
  },
});
