import { View, Text, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { getTrailColor } from '@/theme/map';
import { Trail } from '@/data/types';
import { TrailGeoSeed } from '@/data/seed/slotwinyMap';
import { slotwinyTrails } from '@/data/seed/slotwinyOfficial';
import { selectionTick } from '@/systems/haptics';

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

        // Show start gate marker
        return (
          <View key={geo.trailId}>
            {/* Start gate marker */}
            <Marker
              coordinate={geo.startZone}
              onPress={() => onTrailPress(geo.trailId)}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              opacity={isDimmed ? 0.3 : 1}
            >
              <View style={[styles.startMarker, { borderColor: diffColor }]}>
                <Text style={styles.startFlag}>🏁</Text>
              </View>
            </Marker>

            {/* Finish gate marker */}
            <Marker
              coordinate={geo.finishZone}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
              opacity={isDimmed ? 0.2 : isSelected ? 0.9 : 0.5}
            >
              <View style={styles.finishMarker}>
                <Text style={styles.finishIcon}>🔻</Text>
              </View>
            </Marker>

            {/* Trail name label — on the midpoint of the trail */}
            {!isDimmed && (
              <Marker
                coordinate={getMidpoint(geo.polyline)}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={false}
                onPress={() => onTrailPress(geo.trailId)}
              >
                <View
                  style={[
                    styles.trailLabel,
                    isSelected && { backgroundColor: diffColor, borderColor: diffColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.trailLabelText,
                      isSelected && { color: colors.bg },
                    ]}
                  >
                    {trail.name}
                  </Text>
                  {isHot && <Text style={styles.hotBadge}>🔥</Text>}
                  {hasChallenge && !isHot && <Text style={styles.hotBadge}>⚡</Text>}
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bgCard,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startFlag: {
    fontSize: 14,
  },
  finishMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishIcon: {
    fontSize: 10,
  },
  trailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgOverlay,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xxs,
  },
  trailLabelText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    fontSize: 10,
  },
  hotBadge: {
    fontSize: 10,
  },
});
