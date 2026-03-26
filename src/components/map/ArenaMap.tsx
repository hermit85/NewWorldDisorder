// ═══════════════════════════════════════════════════════════
// Arena Map — Stylized Dark Terrain Map
// Branded mountain basemap with terrain zones, trail hero lines,
// lift corridor, and official race markers.
// Not a utility map. A race system surface.
// ═══════════════════════════════════════════════════════════

import { useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Polyline, Polygon, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { colors } from '@/theme/colors';
import { trailLineWidth, trailLineOpacity, darkMapStyle, getTrailColor, terrainColors } from '@/theme/map';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Trail } from '@/data/types';
import {
  trailGeoSeeds, SLOTWINY_REGION, SLOTWINY_CENTER, LIFT_LINE,
  TrailGeoSeed, terrainZones,
} from '@/data/seed/slotwinyMap';
import { slotwinyTrails } from '@/data/seed/slotwinyOfficial';
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
        mapRef.current.fitToCoordinates(geo.polyline, {
          edgePadding: { top: 120, right: 60, bottom: 300, left: 60 },
          animated: true,
        });
      }
      onTrailSelect(trailId);
    },
    [onTrailSelect]
  );

  const handleMapPress = useCallback(() => {
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
        {/* ═══ TERRAIN ZONES — stylized mountain overlay ═══ */}
        {terrainZones.map((zone) => (
          <Polygon
            key={zone.id}
            coordinates={zone.polygon}
            fillColor={terrainColors[zone.type]}
            strokeColor="transparent"
            strokeWidth={0}
          />
        ))}

        {/* ═══ LIFT LINE — dashed corridor ═══ */}
        <Polyline
          coordinates={[LIFT_LINE.bottom, LIFT_LINE.top]}
          strokeColor={terrainColors.liftLine}
          strokeWidth={2}
          lineDashPattern={[8, 6]}
          lineCap="round"
        />

        {/* Lift label at midpoint */}
        <Marker
          coordinate={{
            latitude: (LIFT_LINE.bottom.latitude + LIFT_LINE.top.latitude) / 2,
            longitude: (LIFT_LINE.bottom.longitude + LIFT_LINE.top.longitude) / 2 + 0.001,
          }}
          anchor={{ x: 0, y: 0.5 }}
          tracksViewChanges={false}
        >
          <View style={styles.liftLabel}>
            <Text style={styles.liftLabelText}>LIFT</Text>
          </View>
        </Marker>

        {/* ═══ TRAIL SHADOW LINES — dark outline for separation ═══ */}
        {trailGeoSeeds.map((geo: TrailGeoSeed) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;
          const isSelected = selectedTrailId === geo.trailId;
          const isDimmed = selectedTrailId !== null && !isSelected;
          if (isDimmed) return null;

          return (
            <Polyline
              key={`shadow-${geo.trailId}`}
              coordinates={geo.polyline}
              strokeColor="rgba(0, 0, 0, 0.6)"
              strokeWidth={isSelected ? trailLineWidth.shadow + 2 : trailLineWidth.shadow}
              lineCap="round"
              lineJoin="round"
            />
          );
        })}

        {/* ═══ TRAIL HERO LINES — official race lines ═══ */}
        {trailGeoSeeds.map((geo: TrailGeoSeed) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;

          const isSelected = selectedTrailId === geo.trailId;
          const isDimmed = selectedTrailId !== null && !isSelected;
          const official = slotwinyTrails.find((o) => o.id === geo.trailId);
          const lineColor = getTrailColor(official?.colorClass, trail.difficulty);

          return (
            <Polyline
              key={geo.trailId}
              coordinates={geo.polyline}
              strokeColor={lineColor}
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

        {/* ═══ TRAIL MARKERS ═══ */}
        <TrailMarkers
          trails={trails}
          trailGeoData={trailGeoSeeds}
          selectedTrailId={selectedTrailId}
          hotTrailId={hotTrailId}
          challengeTrailId={challengeTrailId}
          onTrailPress={handleTrailPress}
        />

        {/* ═══ ARENA LABEL — summit area ═══ */}
        <Marker
          coordinate={{ latitude: 49.4256, longitude: SLOTWINY_CENTER.longitude }}
          anchor={{ x: 0.5, y: 1 }}
          tracksViewChanges={false}
        >
          <View style={styles.arenaLabel}>
            <Text style={styles.arenaLabelTitle}>SŁOTWINY ARENA</Text>
            <Text style={styles.arenaLabelSub}>1114m · SEASON 01</Text>
          </View>
        </Marker>
      </MapView>

      {/* Top edge gradient — blends map into header */}
      <View style={styles.topGradient} pointerEvents="none" />
      {/* Bottom edge gradient — blends map into drawer */}
      <View style={styles.bottomGradient} pointerEvents="none" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080810',
  },
  map: {
    flex: 1,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    backgroundColor: 'rgba(8, 8, 16, 0.7)',
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: 'rgba(8, 8, 16, 0.5)',
  },
  liftLabel: {
    backgroundColor: 'rgba(20, 20, 28, 0.8)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  liftLabelText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 7,
    color: 'rgba(90, 90, 106, 0.6)',
    letterSpacing: 3,
  },
  arenaLabel: {
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  arenaLabelTitle: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.35)',
    letterSpacing: 4,
  },
  arenaLabelSub: {
    ...typography.labelSmall,
    fontSize: 7,
    color: 'rgba(255, 255, 255, 0.15)',
    letterSpacing: 3,
    marginTop: 2,
  },
});
