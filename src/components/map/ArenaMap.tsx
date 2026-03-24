import { useRef, useCallback } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import MapView, { Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '@/theme/colors';
import { trailLineColors, trailLineWidth, trailLineOpacity, darkMapStyle } from '@/theme/map';
import { Trail, Difficulty } from '@/data/types';
import { trailGeoSeeds, SLOTWINY_REGION, TrailGeoSeed } from '@/data/seed/slotwinyMap';
import { TrailMarkers } from './TrailMarkers';

interface Props {
  trails: Trail[];
  selectedTrailId: string | null;
  hotTrailId?: string;
  challengeTrailId?: string | null;
  onTrailSelect: (trailId: string) => void;
  onMapPress: () => void;
}

export function ArenaMap({
  trails,
  selectedTrailId,
  hotTrailId,
  challengeTrailId,
  onTrailSelect,
  onMapPress,
}: Props) {
  const mapRef = useRef<MapView>(null);

  const handleTrailPress = useCallback(
    (trailId: string) => {
      const geo = trailGeoSeeds.find((t: TrailGeoSeed) => t.trailId === trailId);
      if (geo && mapRef.current) {
        // Animate to fit the selected trail
        const coords = geo.polyline;
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 60, bottom: 300, left: 60 },
          animated: true,
        });
      }
      onTrailSelect(trailId);
    },
    [onTrailSelect]
  );

  const handleMapPress = useCallback(() => {
    // Deselect trail and zoom back out
    if (mapRef.current) {
      mapRef.current.animateToRegion(SLOTWINY_REGION, 400);
    }
    onMapPress();
  }, [onMapPress]);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={SLOTWINY_REGION}
        provider={PROVIDER_DEFAULT}
        customMapStyle={Platform.OS === 'android' ? darkMapStyle : undefined}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        userInterfaceStyle="dark"
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsBuildings={false}
        showsIndoors={false}
        showsPointsOfInterests={false}
        pitchEnabled={false}
        rotateEnabled={false}
        onPress={handleMapPress}
      >
        {/* Trail polylines */}
        {trailGeoSeeds.map((geo: TrailGeoSeed) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;

          const isSelected = selectedTrailId === geo.trailId;
          const isDimmed = selectedTrailId !== null && !isSelected;

          return (
            <Polyline
              key={geo.trailId}
              coordinates={geo.polyline}
              strokeColor={trailLineColors[trail.difficulty]}
              strokeWidth={
                isSelected
                  ? trailLineWidth.selected
                  : isDimmed
                    ? trailLineWidth.dimmed
                    : trailLineWidth.default
              }
              lineCap="round"
              lineJoin="round"
              tappable
              onPress={() => handleTrailPress(geo.trailId)}
              style={{
                opacity: isSelected
                  ? trailLineOpacity.selected
                  : isDimmed
                    ? trailLineOpacity.dimmed
                    : trailLineOpacity.default,
              }}
            />
          );
        })}

        {/* Trail markers */}
        <TrailMarkers
          trails={trails}
          trailGeoData={trailGeoSeeds}
          selectedTrailId={selectedTrailId}
          hotTrailId={hotTrailId}
          challengeTrailId={challengeTrailId}
          onTrailPress={handleTrailPress}
        />
      </MapView>

      {/* Gradient overlay at top for header blend */}
      <View style={styles.topGradient} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  map: {
    flex: 1,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'transparent',
  },
});
