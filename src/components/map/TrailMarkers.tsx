import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailColor } from '@/theme/map';
import { Trail } from '@/data/types';
import { TrailGeoSeed } from '@/data/seed/slotwinyMap';
import { slotwinyTrails } from '@/data/seed/slotwinyOfficial';

interface Props {
  trails: Trail[];
  trailGeoData: TrailGeoSeed[];
  selectedTrailId: string | null;
  hotTrailId?: string;
  challengeTrailId?: string | null;
  onTrailPress: (trailId: string) => void;
}

export function TrailMarkers({
  trails,
  trailGeoData,
  selectedTrailId,
  hotTrailId,
  challengeTrailId,
  onTrailPress,
}: Props) {
  return (
    <>
      {trailGeoData.map((geo) => {
        const trail = trails.find((t) => t.id === geo.trailId);
        if (!trail) return null;

        const isSelected = selectedTrailId === geo.trailId;
        const isDimmed = selectedTrailId !== null && !isSelected;
        const isHot = hotTrailId === geo.trailId;
        const hasChallenge = challengeTrailId === geo.trailId;
        const official = slotwinyTrails.find((o) => o.id === geo.trailId);
        const diffColor = getTrailColor(official?.colorClass, trail.difficulty);

        // Use dedicated label anchor if available, else midpoint
        const labelCoord = geo.labelAnchor ?? getMidpoint(geo.polyline);

        return (
          <View key={geo.trailId}>
            {/* Start gate marker — colored circle with S text */}
            <Marker
              coordinate={geo.startZone}
              onPress={() => onTrailPress(geo.trailId)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              opacity={isDimmed ? 0.3 : 1}
            >
              <View style={[styles.startMarker, { borderColor: diffColor, backgroundColor: diffColor + '20' }]}>
                <Text style={[styles.startText, { color: diffColor }]}>S</Text>
              </View>
            </Marker>

            {/* Finish gate marker — small square */}
            <Marker
              coordinate={geo.finishZone}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              opacity={isDimmed ? 0.2 : isSelected ? 0.9 : 0.5}
            >
              <View style={[styles.finishMarker, { borderColor: diffColor }]}>
                <View style={[styles.finishDot, { backgroundColor: diffColor }]} />
              </View>
            </Marker>

            {/* Trail name label — race chip style */}
            {!isDimmed && (
              <Marker
                coordinate={labelCoord}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={() => onTrailPress(geo.trailId)}
              >
                <View
                  style={[
                    styles.trailLabel,
                    isSelected && styles.trailLabelSelected,
                    isSelected && { backgroundColor: diffColor, borderColor: diffColor },
                    !isSelected && { borderColor: diffColor + '30' },
                  ]}
                >
                  {!isSelected && (
                    <View style={[styles.trailDot, { backgroundColor: diffColor }]} />
                  )}
                  <Text
                    style={[
                      styles.trailLabelText,
                      isSelected && styles.trailLabelTextSelected,
                      isSelected && { color: colors.bg },
                    ]}
                  >
                    {official?.shortName ?? trail.name}
                  </Text>
                  {isHot && (
                    <Text style={[styles.badge, isSelected && { color: colors.bg }]}>HOT</Text>
                  )}
                  {hasChallenge && !isHot && (
                    <Text style={[styles.badge, isSelected && { color: colors.bg }]}>!</Text>
                  )}
                </View>
              </Marker>
            )}
          </View>
        );
      })}
    </>
  );
}

function getMidpoint(
  coords: { latitude: number; longitude: number }[]
): { latitude: number; longitude: number } {
  const mid = Math.floor(coords.length / 2);
  return coords[mid];
}

const styles = StyleSheet.create({
  startMarker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 11,
    letterSpacing: 0,
  },
  finishMarker: {
    width: 20,
    height: 20,
    borderRadius: 4,
    backgroundColor: colors.bgCard,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  trailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(12, 12, 20, 0.85)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 1,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  trailLabelSelected: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1.5,
  },
  trailDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  trailLabelText: {
    ...typography.labelSmall,
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 9,
    letterSpacing: 1.5,
  },
  trailLabelTextSelected: {
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: 'Orbitron_700Bold',
  },
  badge: {
    ...typography.labelSmall,
    fontSize: 8,
    color: colors.orange,
    letterSpacing: 0,
  },
});
