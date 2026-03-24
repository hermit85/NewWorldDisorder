// Arena Map — track selection world view (web version)
// Stylized mountain terrain with selectable trail lines
// Feels like a racing game track selection, not a utility map

import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { trailLineColors } from '@/theme/map';
import { Trail } from '@/data/types';
import { getUserTrailStats } from '@/data/mock/userTrailStats';
import { formatTimeShort } from '@/content/copy';
import { slotwinyTrails, OfficialTrail } from '@/data/seed/slotwinyOfficial';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  trails: Trail[];
  selectedTrailId: string | null;
  hotTrailId?: string;
  challengeTrailId?: string | null;
  onTrailSelect: (trailId: string) => void;
  onMapPress: () => void;
}

// Get seed data for game labels
function getOfficialTrail(id: string): OfficialTrail | undefined {
  return slotwinyTrails.find((t) => t.id === id);
}

export function ArenaMapWeb({
  trails,
  selectedTrailId,
  hotTrailId,
  challengeTrailId,
  onTrailSelect,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Terrain background layers */}
      <View style={styles.terrainBg}>
        {/* Mountain ridge silhouette */}
        <View style={styles.ridgeLine} />
        {/* Treeline texture */}
        <View style={styles.treeline} />
        {/* Gradient fade to base */}
        <View style={styles.valleyFade} />
      </View>

      {/* Summit station marker */}
      <View style={styles.summitStation}>
        <Text style={styles.stationIcon}>🗼</Text>
        <Text style={styles.stationLabel}>SUMMIT · 1114m</Text>
      </View>

      {/* Lift line indicator */}
      <View style={styles.liftLine}>
        <View style={styles.liftLineDash} />
        <View style={styles.liftCar}>
          <Text style={styles.liftIcon}>🚡</Text>
        </View>
      </View>

      {/* Trail lines — each positioned to descend from top to bottom */}
      <View style={styles.trailsArea}>
        {trails.map((trail, index) => {
          const isSelected = selectedTrailId === trail.id;
          const isDimmed = selectedTrailId !== null && !isSelected;
          const diffColor = trailLineColors[trail.difficulty];
          const isHot = hotTrailId === trail.id;
          const hasChallenge = challengeTrailId === trail.id;
          const official = getOfficialTrail(trail.id);
          const stats = getUserTrailStats(trail.id);

          // Spread trails across horizontal space
          const xOffset = 12 + (index * 76) / (trails.length - 1);

          return (
            <Pressable
              key={trail.id}
              style={[
                styles.trailLane,
                {
                  left: `${xOffset}%`,
                  opacity: isDimmed ? 0.15 : 1,
                },
              ]}
              onPress={() => onTrailSelect(trail.id)}
            >
              {/* Start gate */}
              <View style={[styles.gate, styles.startGate, { borderColor: diffColor }]}>
                <Text style={styles.gateIcon}>▼</Text>
              </View>

              {/* Trail line */}
              <View
                style={[
                  styles.trailLine,
                  {
                    backgroundColor: diffColor,
                    width: isSelected ? 5 : 3,
                    shadowColor: isSelected ? diffColor : 'transparent',
                    shadowRadius: isSelected ? 12 : 0,
                    shadowOpacity: isSelected ? 0.8 : 0,
                  },
                ]}
              />

              {/* Trail label */}
              <View
                style={[
                  styles.trailLabel,
                  isSelected && { backgroundColor: diffColor + '30', borderColor: diffColor },
                ]}
              >
                <Text
                  style={[styles.trailLabelName, isSelected && { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {official?.shortName ?? trail.name}
                </Text>
                {isHot && <Text style={styles.badge}>🔥</Text>}
                {hasChallenge && !isHot && <Text style={styles.badge}>⚡</Text>}
              </View>

              {/* Difficulty tag */}
              <View style={[styles.diffTag, { backgroundColor: diffColor + '25' }]}>
                <Text style={[styles.diffText, { color: diffColor }]}>
                  {trail.difficulty.toUpperCase()}
                </Text>
              </View>

              {/* PB indicator */}
              {stats?.pbMs && (
                <View style={styles.pbTag}>
                  <Text style={styles.pbText}>{formatTimeShort(stats.pbMs)}</Text>
                </View>
              )}

              {/* Finish zone */}
              <View style={[styles.gate, styles.finishGate, { borderColor: diffColor }]}>
                <Text style={styles.gateIcon}>◼</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Base station marker */}
      <View style={styles.baseStation}>
        <Text style={styles.stationIcon}>🎫</Text>
        <Text style={styles.stationLabel}>BASE · 780m</Text>
      </View>

      {/* Altitude bar */}
      <View style={styles.altitudeBar}>
        <Text style={styles.altText}>↑ 1114m</Text>
        <View style={styles.altLine} />
        <Text style={styles.altText}>↓ 780m</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#08080D',
    overflow: 'hidden',
  },

  // Terrain
  terrainBg: {
    ...StyleSheet.absoluteFillObject,
  },
  ridgeLine: {
    position: 'absolute',
    top: '8%',
    left: '5%',
    right: '5%',
    height: 2,
    backgroundColor: colors.border,
    opacity: 0.3,
  },
  treeline: {
    position: 'absolute',
    top: '10%',
    left: 0,
    right: 0,
    bottom: '15%',
    backgroundColor: '#0C0C14',
    opacity: 0.6,
  },
  valleyFade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '20%',
    backgroundColor: colors.bg,
  },

  // Stations
  summitStation: {
    position: 'absolute',
    top: '4%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgCard,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 5,
  },
  baseStation: {
    position: 'absolute',
    bottom: '4%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgCard,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 5,
  },
  stationIcon: {
    fontSize: 12,
  },
  stationLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 9,
    letterSpacing: 2,
  },

  // Lift line
  liftLine: {
    position: 'absolute',
    top: '8%',
    bottom: '10%',
    right: '8%',
    width: 1,
    alignItems: 'center',
    zIndex: 2,
  },
  liftLineDash: {
    flex: 1,
    width: 1,
    backgroundColor: colors.textTertiary,
    opacity: 0.15,
  },
  liftCar: {
    position: 'absolute',
    top: '40%',
  },
  liftIcon: {
    fontSize: 14,
    opacity: 0.4,
  },

  // Trail area
  trailsArea: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    left: 0,
    right: 0,
  },

  // Individual trail lane
  trailLane: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 70,
    alignItems: 'center',
  },

  // Gates
  gate: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bgCard,
    zIndex: 3,
  },
  startGate: {
    marginBottom: spacing.xs,
  },
  finishGate: {
    marginTop: spacing.xs,
  },
  gateIcon: {
    fontSize: 8,
    color: colors.textTertiary,
  },

  // Trail line
  trailLine: {
    flex: 1,
    borderRadius: 3,
  },

  // Trail label
  trailLabel: {
    position: 'absolute',
    top: '35%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.bgOverlay,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
    maxWidth: 90,
    zIndex: 4,
  },
  trailLabelName: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 9,
    letterSpacing: 0.5,
  },
  badge: {
    fontSize: 9,
  },

  // Difficulty tag
  diffTag: {
    position: 'absolute',
    top: '50%',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    zIndex: 4,
  },
  diffText: {
    ...typography.labelSmall,
    fontSize: 8,
    letterSpacing: 1,
  },

  // PB
  pbTag: {
    position: 'absolute',
    top: '62%',
    zIndex: 4,
  },
  pbText: {
    ...typography.labelSmall,
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 0.5,
  },

  // Altitude bar
  altitudeBar: {
    position: 'absolute',
    top: '10%',
    bottom: '10%',
    left: spacing.sm,
    width: 24,
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 3,
  },
  altLine: {
    flex: 1,
    width: 1,
    backgroundColor: colors.textTertiary,
    opacity: 0.2,
    marginVertical: spacing.xs,
  },
  altText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    fontSize: 7,
    letterSpacing: 1,
  },
});
