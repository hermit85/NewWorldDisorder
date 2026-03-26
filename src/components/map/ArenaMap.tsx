// ═══════════════════════════════════════════════════════════
// Arena Map — Custom branded trail surface (no map SDK)
// Dark terrain canvas with trail geometry rendered directly.
// Zero Google Maps feel. Official gravity race system.
// ═══════════════════════════════════════════════════════════

import { useCallback, useMemo } from 'react';
import { StyleSheet, View, Text, Pressable, Dimensions } from 'react-native';
import { colors } from '@/theme/colors';
import { trailLineWidth, trailLineOpacity, getTrailColor } from '@/theme/map';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { Trail } from '@/data/types';
import {
  trailGeoSeeds, SLOTWINY_REGION, LIFT_LINE,
  TrailGeoSeed, terrainZones,
} from '@/data/seed/slotwinyMap';
import { slotwinyTrails } from '@/data/seed/slotwinyOfficial';

const { width: SCREEN_W } = Dimensions.get('window');

interface Props {
  trails: Trail[];
  selectedTrailId: string | null;
  hotTrailId?: string;
  challengeTrailId?: string | null;
  onTrailSelect: (trailId: string) => void;
  onMapPress: () => void;
}

// ── Coordinate projection ────────────────────────────────
// Projects lat/lng to pixel X/Y within view bounds.
// No map tiles, no SDK — pure geometry.

const MAP_PADDING = { top: 60, bottom: 30, left: 20, right: 20 };

function useProjection(viewHeight: number) {
  return useMemo(() => {
    const viewW = SCREEN_W;
    const drawW = viewW - MAP_PADDING.left - MAP_PADDING.right;
    const drawH = viewHeight - MAP_PADDING.top - MAP_PADDING.bottom;

    const latMin = SLOTWINY_REGION.latitude - SLOTWINY_REGION.latitudeDelta / 2;
    const latMax = SLOTWINY_REGION.latitude + SLOTWINY_REGION.latitudeDelta / 2;
    const lngMin = SLOTWINY_REGION.longitude - SLOTWINY_REGION.longitudeDelta / 2;
    const lngMax = SLOTWINY_REGION.longitude + SLOTWINY_REGION.longitudeDelta / 2;

    return (coord: { latitude: number; longitude: number }) => {
      const x = MAP_PADDING.left + ((coord.longitude - lngMin) / (lngMax - lngMin)) * drawW;
      // Latitude increases northward, Y increases downward
      const y = MAP_PADDING.top + ((latMax - coord.latitude) / (latMax - latMin)) * drawH;
      return { x, y };
    };
  }, [viewHeight]);
}

// ── Trail line as connected View segments ─────────────────

function TrailLine({
  geo,
  color,
  width,
  opacity,
  project,
  onPress,
}: {
  geo: TrailGeoSeed;
  color: string;
  width: number;
  opacity: number;
  project: (c: { latitude: number; longitude: number }) => { x: number; y: number };
  onPress: () => void;
}) {
  const points = geo.polyline.map(project);

  return (
    <Pressable style={StyleSheet.absoluteFill} onPress={onPress}>
      {points.map((p, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const dx = p.x - prev.x;
        const dy = p.y - prev.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: prev.x,
              top: prev.y - width / 2,
              width: len + 1,
              height: width,
              backgroundColor: color,
              opacity,
              borderRadius: width / 2,
              transform: [
                { rotate: `${angle}deg` },
              ],
              transformOrigin: `0px ${width / 2}px`,
            }}
          />
        );
      })}
    </Pressable>
  );
}

// ── Terrain zone polygon fill ────────────────────────────

function TerrainFill({
  zone,
  project,
}: {
  zone: { polygon: { latitude: number; longitude: number }[]; type: string };
  project: (c: { latitude: number; longitude: number }) => { x: number; y: number };
}) {
  const points = zone.polygon.map(project);

  // Approximate polygon fill with a bounding View + clip
  const minX = Math.min(...points.map(p => p.x));
  const maxX = Math.max(...points.map(p => p.x));
  const minY = Math.min(...points.map(p => p.y));
  const maxY = Math.max(...points.map(p => p.y));

  const fillColor = zone.type === 'forest'
    ? 'rgba(6, 18, 10, 0.7)'
    : zone.type === 'openSlope'
      ? 'rgba(14, 18, 12, 0.4)'
      : zone.type === 'summit'
        ? 'rgba(18, 22, 16, 0.35)'
        : 'rgba(10, 12, 16, 0.5)';

  return (
    <View
      style={{
        position: 'absolute',
        left: minX,
        top: minY,
        width: maxX - minX,
        height: maxY - minY,
        backgroundColor: fillColor,
        borderRadius: 8,
      }}
    />
  );
}

// ── Component ────────────────────────────────────────────

export function ArenaMap({
  trails,
  selectedTrailId,
  hotTrailId,
  onTrailSelect,
  onMapPress,
}: Props) {
  const MAP_HEIGHT = SCREEN_W * 1.3; // tall portrait ratio for mountain
  const project = useProjection(MAP_HEIGHT);

  const handleTrailPress = useCallback(
    (trailId: string) => { onTrailSelect(trailId); },
    [onTrailSelect],
  );

  // Project lift line
  const liftTop = project(LIFT_LINE.top);
  const liftBot = project(LIFT_LINE.bottom);

  return (
    <Pressable style={[styles.container, { height: MAP_HEIGHT }]} onPress={onMapPress}>
      {/* ═══ BACKGROUND TERRAIN ═══ */}

      {/* Contour hint lines */}
      {Array.from({ length: 8 }, (_, i) => {
        const y = MAP_PADDING.top + (i + 1) * ((MAP_HEIGHT - MAP_PADDING.top - MAP_PADDING.bottom) / 9);
        return (
          <View key={`contour-${i}`} style={[styles.contourLine, { top: y }]} />
        );
      })}

      {/* Terrain zone fills */}
      {terrainZones.map((zone) => (
        <TerrainFill key={zone.id} zone={zone} project={project} />
      ))}

      {/* Lift corridor */}
      <View style={{
        position: 'absolute',
        left: liftTop.x - 0.5,
        top: liftTop.y,
        width: 1,
        height: liftBot.y - liftTop.y,
        backgroundColor: 'rgba(90, 90, 106, 0.2)',
      }} />

      {/* ═══ TRAIL SHADOW + HERO LINES ═══ */}
      {trailGeoSeeds.map((geo: TrailGeoSeed) => {
        const trail = trails.find((t) => t.id === geo.trailId);
        if (!trail) return null;

        const isSelected = selectedTrailId === geo.trailId;
        const isDimmed = selectedTrailId !== null && !isSelected;
        const official = slotwinyTrails.find((o) => o.id === geo.trailId);
        const lineColor = getTrailColor(official?.colorClass, trail.difficulty);

        const w = isSelected ? trailLineWidth.selected : isDimmed ? trailLineWidth.dimmed : trailLineWidth.default;
        const o = isSelected ? trailLineOpacity.selected : isDimmed ? trailLineOpacity.dimmed : trailLineOpacity.default;

        return (
          <View key={geo.trailId}>
            {/* Shadow */}
            {!isDimmed && (
              <TrailLine
                geo={geo}
                color="#000000"
                width={w + 4}
                opacity={0.5}
                project={project}
                onPress={() => handleTrailPress(geo.trailId)}
              />
            )}
            {/* Trail */}
            <TrailLine
              geo={geo}
              color={lineColor}
              width={w}
              opacity={o}
              project={project}
              onPress={() => handleTrailPress(geo.trailId)}
            />
          </View>
        );
      })}

      {/* ═══ MARKERS ═══ */}
      {trailGeoSeeds.map((geo: TrailGeoSeed) => {
        const trail = trails.find((t) => t.id === geo.trailId);
        if (!trail) return null;

        const isSelected = selectedTrailId === geo.trailId;
        const isDimmed = selectedTrailId !== null && !isSelected;
        const official = slotwinyTrails.find((o) => o.id === geo.trailId);
        const diffColor = getTrailColor(official?.colorClass, trail.difficulty);
        const isHot = hotTrailId === geo.trailId;

        const startPt = project(geo.startZone);
        const finishPt = project(geo.finishZone);
        const labelPt = geo.labelAnchor ? project(geo.labelAnchor) : project(geo.polyline[Math.floor(geo.polyline.length / 2)]);

        return (
          <View key={`markers-${geo.trailId}`} pointerEvents="none">
            {/* Start gate */}
            <View style={[styles.startMarker, {
              left: startPt.x - 12, top: startPt.y - 12,
              borderColor: diffColor, backgroundColor: diffColor + '20',
              opacity: isDimmed ? 0.3 : 1,
            }]}>
              <Text style={[styles.startText, { color: diffColor }]}>S</Text>
            </View>

            {/* Finish gate */}
            <View style={[styles.finishMarker, {
              left: finishPt.x - 8, top: finishPt.y - 8,
              borderColor: diffColor,
              opacity: isDimmed ? 0.2 : isSelected ? 0.9 : 0.5,
            }]}>
              <View style={[styles.finishDot, { backgroundColor: diffColor }]} />
            </View>

            {/* Trail label */}
            {!isDimmed && (
              <View style={[
                styles.trailLabel,
                { left: labelPt.x - 30, top: labelPt.y - 10 },
                isSelected && { backgroundColor: diffColor, borderColor: diffColor },
                !isSelected && { borderColor: diffColor + '40' },
              ]}>
                <View style={[styles.trailDot, { backgroundColor: diffColor }]} />
                <Text style={[styles.trailLabelText, isSelected && { color: '#0A0A0F' }]}>
                  {official?.shortName ?? trail.name}
                </Text>
                {isHot && <Text style={styles.badge}>HOT</Text>}
              </View>
            )}
          </View>
        );
      })}

      {/* ═══ SYSTEM OVERLAYS ═══ */}

      {/* Arena title */}
      <View style={styles.arenaHeader}>
        <Text style={styles.arenaTitle}>SŁOTWINY ARENA</Text>
        <Text style={styles.arenaSub}>1114m · SEASON 01</Text>
      </View>

      {/* Altitude bar */}
      <View style={styles.altBar}>
        <Text style={styles.altText}>1114m</Text>
        <View style={styles.altLine} />
        <Text style={styles.altText}>780m</Text>
      </View>

      {/* Lift label */}
      <View style={[styles.liftLabel, { left: liftTop.x + 6, top: (liftTop.y + liftBot.y) / 2 - 6 }]}>
        <Text style={styles.liftLabelText}>LIFT</Text>
      </View>

      {/* Top gradient */}
      <View style={styles.topGradient} pointerEvents="none" />
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#080810',
    overflow: 'hidden',
    width: '100%',
  },

  // Contour hints
  contourLine: {
    position: 'absolute',
    left: 30,
    right: 30,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(90, 90, 106, 0.08)',
  },

  // Start/finish markers
  startMarker: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 9,
  },
  finishMarker: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 3,
    backgroundColor: '#14141C',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  // Trail labels
  trailLabel: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(10, 10, 15, 0.85)',
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(42, 42, 56, 0.5)',
    gap: spacing.xs,
  },
  trailDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  trailLabelText: {
    ...typography.labelSmall,
    color: colors.textPrimary,
    fontSize: 9,
    letterSpacing: 1,
  },
  badge: {
    ...typography.labelSmall,
    fontSize: 7,
    color: colors.orange,
  },

  // System overlays
  arenaHeader: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    alignItems: 'center',
  },
  arenaTitle: {
    fontFamily: 'Orbitron_700Bold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.3)',
    letterSpacing: 5,
  },
  arenaSub: {
    ...typography.labelSmall,
    fontSize: 7,
    color: 'rgba(255, 255, 255, 0.12)',
    letterSpacing: 3,
    marginTop: 2,
  },

  altBar: {
    position: 'absolute',
    top: MAP_PADDING.top,
    bottom: MAP_PADDING.bottom,
    left: 6,
    width: 20,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  altLine: {
    flex: 1,
    width: 1,
    backgroundColor: 'rgba(90, 90, 106, 0.1)',
    marginVertical: 4,
  },
  altText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 6,
    color: 'rgba(90, 90, 106, 0.4)',
    letterSpacing: 1,
  },

  liftLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(20, 20, 28, 0.8)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  liftLabelText: {
    fontFamily: 'Orbitron_400Regular',
    fontSize: 6,
    color: 'rgba(90, 90, 106, 0.5)',
    letterSpacing: 3,
  },

  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 50,
    backgroundColor: 'rgba(8, 8, 16, 0.6)',
  },
});
