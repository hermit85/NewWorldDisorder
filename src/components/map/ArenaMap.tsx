// ═══════════════════════════════════════════════════════════
// Arena Map — NWD Branded Race Surface v1
// Dark terrain map with glow trails, edge gradients,
// wide tap targets, and terrain zone overlays.
// ═══════════════════════════════════════════════════════════

import { useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Polyline, Polygon, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import {
  trailLineWidth,
  trailLineOpacity,
  trailGlowOpacity,
  darkMapStyle,
  getTrailColor,
  terrainColors,
} from '@/theme/map';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';
import { Trail } from '@/data/types';
import { TrailGeoSeed } from '@/data/venueConfig';
import { TrailMarkers } from './TrailMarkers';

// Checkpoint C: hardcoded Słotwiny geometry removed. This component
// is currently only reachable if a venue config resolves in the parent
// screen, which never happens post-seed-wipe. Until Sprint 3 rewires
// it to take geometry via props, stub out the former module-level
// constants as empty placeholders so the file still type-checks.
// TODO Sprint 3: accept geometry/region/lifts via props from caller.
const trailGeoSeeds: TrailGeoSeed[] = [];
const slotwinyTrails: any[] = [];
const SLOTWINY_REGION = { latitude: 49.42, longitude: 20.95, latitudeDelta: 0.02, longitudeDelta: 0.02 };
const SLOTWINY_CENTER = { latitude: 49.42, longitude: 20.95 };
const LIFT_LINE = {
  bottom: { latitude: 49.41, longitude: 20.95 },
  top: { latitude: 49.43, longitude: 20.95 },
};
const terrainZones: Array<{ id: string; polygon: { latitude: number; longitude: number }[]; colorKey: keyof typeof terrainColors; type: keyof typeof terrainColors }> = [];

// ── IN-MAP FOG SYSTEM ──
// Large polygons rendered INSIDE MapView — they sit UNDER Polylines/Markers.
// This suppresses Apple Maps base layer while trails render clean on top.
// Extends well beyond visible region so edges are never seen.
const FOG_COLOR = 'rgba(7, 7, 16, 0.58)';
const FOG_HEAVY = 'rgba(7, 7, 16, 0.72)';

// Main fog — covers entire arena region
const FOG_MAIN = [
  { latitude: 49.440, longitude: 20.935 },
  { latitude: 49.440, longitude: 20.975 },
  { latitude: 49.400, longitude: 20.975 },
  { latitude: 49.400, longitude: 20.935 },
];

// Peripheral fog masses — heavier coverage on map edges
// Northwest (far from any trail)
const FOG_NW = [
  { latitude: 49.440, longitude: 20.935 },
  { latitude: 49.440, longitude: 20.950 },
  { latitude: 49.435, longitude: 20.952 },
  { latitude: 49.428, longitude: 20.948 },
  { latitude: 49.424, longitude: 20.944 },
  { latitude: 49.418, longitude: 20.946 },
  { latitude: 49.412, longitude: 20.948 },
  { latitude: 49.408, longitude: 20.944 },
  { latitude: 49.400, longitude: 20.935 },
];

// Southeast (below Dzida, away from trails)
const FOG_SE = [
  { latitude: 49.416, longitude: 20.958 },
  { latitude: 49.418, longitude: 20.965 },
  { latitude: 49.415, longitude: 20.975 },
  { latitude: 49.400, longitude: 20.975 },
  { latitude: 49.400, longitude: 20.955 },
  { latitude: 49.406, longitude: 20.956 },
  { latitude: 49.410, longitude: 20.955 },
];

// South base (below finish zones)
const FOG_S = [
  { latitude: 49.413, longitude: 20.935 },
  { latitude: 49.414, longitude: 20.955 },
  { latitude: 49.412, longitude: 20.960 },
  { latitude: 49.408, longitude: 20.962 },
  { latitude: 49.400, longitude: 20.960 },
  { latitude: 49.400, longitude: 20.935 },
];

// Northeast (above and right of Dzida)
const FOG_NE = [
  { latitude: 49.440, longitude: 20.960 },
  { latitude: 49.440, longitude: 20.975 },
  { latitude: 49.425, longitude: 20.975 },
  { latitude: 49.420, longitude: 20.968 },
  { latitude: 49.425, longitude: 20.962 },
  { latitude: 49.430, longitude: 20.958 },
  { latitude: 49.435, longitude: 20.958 },
];

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
        {/* ═══ TERRAIN ZONES ═══ */}
        {terrainZones.map((zone) => (
          <Polygon
            key={zone.id}
            coordinates={zone.polygon}
            fillColor={terrainColors[zone.type]}
            strokeColor="transparent"
            strokeWidth={0}
          />
        ))}

        {/* ═══ FOG SYSTEM — renders UNDER trails, suppresses base map ═══ */}
        <Polygon
          coordinates={FOG_MAIN}
          fillColor={FOG_COLOR}
          strokeColor="transparent"
          strokeWidth={0}
        />
        <Polygon
          coordinates={FOG_NW}
          fillColor={FOG_HEAVY}
          strokeColor="transparent"
          strokeWidth={0}
        />
        <Polygon
          coordinates={FOG_SE}
          fillColor={FOG_HEAVY}
          strokeColor="transparent"
          strokeWidth={0}
        />
        <Polygon
          coordinates={FOG_S}
          fillColor={FOG_HEAVY}
          strokeColor="transparent"
          strokeWidth={0}
        />
        <Polygon
          coordinates={FOG_NE}
          fillColor={FOG_HEAVY}
          strokeColor="transparent"
          strokeWidth={0}
        />

        {/* ═══ LIFT LINE ═══ */}
        <Polyline
          coordinates={[LIFT_LINE.bottom, LIFT_LINE.top]}
          strokeColor={terrainColors.liftLine}
          strokeWidth={2}
          lineDashPattern={[8, 6]}
          lineCap="round"
        />
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

        {/* ═══ TAP HIT TARGETS — invisible wide polylines ═══ */}
        {trailGeoSeeds.map((geo: TrailGeoSeed) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;

          return (
            <Polyline
              key={`hit-${geo.trailId}`}
              coordinates={geo.polyline}
              strokeColor="rgba(0,0,0,0.001)"
              strokeWidth={trailLineWidth.hitTarget}
              lineCap="round"
              lineJoin="round"
              tappable
              onPress={() => handleTrailPress(geo.trailId)}
            />
          );
        })}

        {/* ═══ TRAIL GLOW LINES — soft color aura ═══ */}
        {trailGeoSeeds.map((geo: TrailGeoSeed) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;

          const isSelected = selectedTrailId === geo.trailId;
          const isDimmed = selectedTrailId !== null && !isSelected;
          if (isDimmed) return null;

          const official = slotwinyTrails.find((o) => o.id === geo.trailId);
          const lineColor = getTrailColor(official?.colorClass, trail.difficulty);

          return (
            <Polyline
              key={`glow-${geo.trailId}`}
              coordinates={geo.polyline}
              strokeColor={lineColor}
              strokeWidth={isSelected ? trailLineWidth.selectedGlow : trailLineWidth.glow}
              lineCap="round"
              lineJoin="round"
              style={{
                opacity: isSelected
                  ? trailGlowOpacity.selected
                  : trailGlowOpacity.default,
              }}
            />
          );
        })}

        {/* ═══ TRAIL SHADOW LINES ═══ */}
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
              strokeWidth={isSelected ? trailLineWidth.selectedShadow : trailLineWidth.shadow}
              lineCap="round"
              lineJoin="round"
            />
          );
        })}

        {/* ═══ TRAIL HERO LINES ═══ */}
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

        {/* ═══ ARENA LABEL ═══ */}
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

      {/* ═══ UI CHROME VIGNETTES — blends map edges into app shell ═══ */}
      {/* No more global scrim — fog polygons handle base map suppression */}
      {/* These only blend the edges into header/cards/container background */}
      <LinearGradient
        colors={[
          'rgba(7, 7, 16, 0.90)',
          'rgba(7, 7, 16, 0.45)',
          'rgba(7, 7, 16, 0.10)',
          'transparent',
        ] as const}
        style={[styles.edgeGradient, styles.vignetteTop]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          'transparent',
          'rgba(7, 7, 16, 0.10)',
          'rgba(7, 7, 16, 0.50)',
          'rgba(7, 7, 16, 0.92)',
        ] as const}
        style={[styles.edgeGradient, styles.vignetteBottom]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(7, 7, 16, 0.60)', 'rgba(7, 7, 16, 0.15)', 'transparent'] as const}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.sideGradient, styles.vignetteLeft]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(7, 7, 16, 0.15)', 'rgba(7, 7, 16, 0.60)'] as const}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.sideGradient, styles.vignetteRight]}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070710',
  },
  map: {
    flex: 1,
  },
  // Gradient layers (UI chrome blending only — fog polygons handle base map)
  edgeGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  vignetteTop: {
    top: 0,
    height: 180,
  },
  vignetteBottom: {
    bottom: 0,
    height: 160,
  },
  sideGradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  vignetteLeft: {
    left: 0,
    width: 70,
  },
  vignetteRight: {
    right: 0,
    width: 70,
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
