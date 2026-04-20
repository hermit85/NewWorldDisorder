// ═══════════════════════════════════════════════════════════
// ArenaMapCustom — NWD Custom SVG Selection Surface
//
// Replaces Apple Maps with a fully controlled dark canvas.
// Trails rendered as SVG paths. Zero map tile dependency.
// Drop-in replacement for ArenaMap (same Props interface).
// ═══════════════════════════════════════════════════════════

import { useCallback, useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Pressable, LayoutChangeEvent, Animated } from 'react-native';
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
  Rect,
  Polygon as SvgPolygon,
  Path,
  Line,
  Circle,
} from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { colors } from '@/theme/colors';
import {
  trailLineWidth,
  trailLineOpacity,
  trailGlowOpacity,
  getTrailColor,
  terrainFill,
  terrainStroke,
  terrainColors,
} from '@/theme/map';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { Trail } from '@/data/types';
import type { VenueConfig, TrailGeo, TerrainZone as VenueTerrainZone, LiftLine } from '@/data/venueConfig';
import {
  SVG_VIEWBOX,
  SVG_WIDTH,
  SVG_HEIGHT,
  STROKE_SCALE,
  geoToSvg,
  polylineToPath,
  polygonToPoints,
  svgToScreen,
} from '@/utils/geoToSvg';

// ── Focus target for viewport reframing ──
export type FocusTarget = 'start' | 'rider' | 'both' | null;

// ── Props ──
interface Props {
  venue: VenueConfig;
  trails: Trail[];
  selectedTrailId: string | null;
  hotTrailId?: string;
  challengeTrailId?: string | null;
  riderPosition?: { latitude: number; longitude: number } | null;
  highlightStart?: boolean;
  focusTarget?: FocusTarget;
  onTrailSelect: (trailId: string) => void;
  onMapPress: () => void;
}

export function ArenaMapCustom({
  venue,
  trails,
  selectedTrailId,
  hotTrailId,
  challengeTrailId,
  riderPosition,
  highlightStart,
  focusTarget,
  onTrailSelect,
  onMapPress,
}: Props) {
  // Derive venue data
  const venueBounds = venue.bounds;
  const venueTrailGeo = venue.trailGeo;
  const venueTerrainZones = venue.terrainZones;
  const venueLiftLines = venue.liftLines;
  const venueTrails = venue.trails;

  // Venue-bound geo helpers
  const toSvg = (lat: number, lng: number) => geoToSvg(lat, lng, venueBounds);
  const toPath = (coords: { latitude: number; longitude: number }[]) => polylineToPath(coords, venueBounds);
  const toPoints = (coords: { latitude: number; longitude: number }[]) => polygonToPoints(coords, venueBounds);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [labelWidths, setLabelWidths] = useState<Record<string, number>>({});

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize({ width, height });
  }, []);

  // ── Start gate highlight pulse ──
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (highlightStart && selectedTrailId) {
      // Run 3 quick pulses then stop
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
        { iterations: 3 },
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [highlightStart, selectedTrailId]);

  const pulseScale = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const pulseOpacity = pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] });

  // ── Viewport reframing animation ──
  const animProgress = useRef(new Animated.Value(0)).current;
  const focusParamsRef = useRef({ tx: 0, ty: 0, scale: 1.5 });

  useEffect(() => {
    if (!focusTarget || containerSize.width === 0) {
      Animated.timing(animProgress, { toValue: 0, duration: 350, useNativeDriver: true }).start();
      return;
    }

    const cw = containerSize.width;
    const ch = containerSize.height;
    let focusScale = 1.5; // softer default zoom
    let targetScreenX = cw / 2;
    let targetScreenY = ch / 2;

    if (focusTarget === 'both' && selectedTrailId && riderPosition) {
      // Fit-both: midpoint of rider + start with adaptive zoom
      const geo = venueTrailGeo.find((t) => t.trailId === selectedTrailId);
      if (geo) {
        const rSvg = toSvg(riderPosition.latitude, riderPosition.longitude);
        const sSvg = toSvg(geo.startZone.latitude, geo.startZone.longitude);
        const midSvg = { x: (rSvg.x + sSvg.x) / 2, y: (rSvg.y + sSvg.y) / 2 };
        const midScreen = svgToScreen(midSvg.x, midSvg.y, cw, ch);
        targetScreenX = midScreen.left;
        targetScreenY = midScreen.top;
        // Adaptive zoom: closer points → more zoom, farther → less
        const rScreen = svgToScreen(rSvg.x, rSvg.y, cw, ch);
        const sScreen = svgToScreen(sSvg.x, sSvg.y, cw, ch);
        const spanX = Math.abs(rScreen.left - sScreen.left);
        const spanY = Math.abs(rScreen.top - sScreen.top);
        const span = Math.max(spanX, spanY, 60); // min 60px span
        const maxDim = Math.min(cw, ch) * 0.5; // we want both to fit in 50% of viewport
        focusScale = Math.min(Math.max(maxDim / span, 1.2), 2.0);
      }
    } else if (focusTarget === 'start' && selectedTrailId) {
      const geo = venueTrailGeo.find((t) => t.trailId === selectedTrailId);
      if (geo) {
        const svgPt = toSvg(geo.startZone.latitude, geo.startZone.longitude);
        const screen = svgToScreen(svgPt.x, svgPt.y, cw, ch);
        targetScreenX = screen.left;
        targetScreenY = screen.top;
        focusScale = 1.6;
      }
    } else if (focusTarget === 'rider' && riderPosition) {
      const svgPt = toSvg(riderPosition.latitude, riderPosition.longitude);
      const screen = svgToScreen(svgPt.x, svgPt.y, cw, ch);
      targetScreenX = screen.left;
      targetScreenY = screen.top;
      focusScale = 1.6;
    } else {
      Animated.timing(animProgress, { toValue: 0, duration: 350, useNativeDriver: true }).start();
      return;
    }

    focusParamsRef.current = { tx: targetScreenX, ty: targetScreenY, scale: focusScale };
    Animated.timing(animProgress, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [focusTarget, selectedTrailId, riderPosition, containerSize]);

  // Animated transform: zoom to focusParamsRef target
  // Transform order: [translateX, translateY, scale] means visually:
  //   1. translate the view
  //   2. scale from view center
  // A point at (px) ends up at: cx + (px - cx) * S + TX
  // To center target: TX = (cx - fp.tx) * S
  const cx = containerSize.width / 2;
  const cy = containerSize.height / 2;
  const fp = focusParamsRef.current;
  const S = fp.scale;

  // Clamp: prevent canvas from scrolling past its scaled edges
  // After transform, content spans [cx + (0 - cx)*S + TX, cx + (cw - cx)*S + TX]
  // = [cx*(1-S) + TX, cx*(1-S) + cw*S + TX]
  // Left edge must be ≤ 0:  cx*(1-S) + TX ≤ 0  →  TX ≤ cx*(S-1)
  // Right edge must be ≥ cw: cx*(1-S) + cw*S + TX ≥ cw  →  TX ≥ cw*(1-S) + cx*(S-1) = (cw-cx)*(1-S) ... = -(cw-cx)*(S-1) = -cx*(S-1) for centered
  // Simplified: TX ∈ [-(cw*(S-1))/2, (cw*(S-1))/2] when cx = cw/2
  const maxTX = (containerSize.width * (S - 1)) / 2;
  const maxTY = (containerSize.height * (S - 1)) / 2;

  const rawTX = (cx - fp.tx) * S;
  const rawTY = (cy - fp.ty) * S;
  const clampedTX = Math.max(-maxTX, Math.min(maxTX, rawTX));
  const clampedTY = Math.max(-maxTY, Math.min(maxTY, rawTY));

  const animScale = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, S],
  });
  const animTX = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, clampedTX],
  });
  const animTY = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, clampedTY],
  });

  const handleTrailPress = useCallback(
    (trailId: string) => {
      onTrailSelect(trailId);
    },
    [onTrailSelect],
  );

  // Lift line SVG coords (first lift line from venue config)
  const firstLift = venueLiftLines[0];
  const liftBottom = firstLift ? toSvg(firstLift.bottom.latitude, firstLift.bottom.longitude) : { x: 0, y: 0 };
  const liftTop = firstLift ? toSvg(firstLift.top.latitude, firstLift.top.longitude) : { x: 0, y: 0 };
  const liftMid = {
    x: (liftBottom.x + liftTop.x) / 2 + 12 * STROKE_SCALE,
    y: (liftBottom.y + liftTop.y) / 2,
  };

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {/* ═══ VIEWPORT TRANSFORM WRAPPER ═══ */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            transform: [
              { translateX: animTX },
              { translateY: animTY },
              { scale: animScale },
            ],
          },
        ]}
        pointerEvents="box-none"
      >
      {/* ═══ SVG CANVAS ═══ */}
      <Svg
        viewBox={SVG_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        style={StyleSheet.absoluteFill}
      >
        {/* ── Background gradient + depth definitions ── */}
        <Defs>
          <SvgLinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0E0E1A" />
            <Stop offset="0.25" stopColor="#0A0A14" />
            <Stop offset="0.55" stopColor="#070710" />
            <Stop offset="0.8" stopColor="#06060E" />
            <Stop offset="1" stopColor="#04040A" />
          </SvgLinearGradient>
          {/* Stage light — focused glow on trail arena */}
          <SvgLinearGradient id="stageLight" x1="0.5" y1="0.15" x2="0.5" y2="0.75">
            <Stop offset="0" stopColor="rgba(18, 24, 32, 0.30)" />
            <Stop offset="0.4" stopColor="rgba(14, 18, 26, 0.18)" />
            <Stop offset="0.7" stopColor="rgba(10, 14, 20, 0.08)" />
            <Stop offset="1" stopColor="transparent" />
          </SvgLinearGradient>
        </Defs>
        <Rect
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          fill="url(#bgGrad)"
          onPress={onMapPress}
        />
        {/* Stage light — focused on trail arena, tighter ellipse */}
        <Rect
          x={SVG_WIDTH * 0.18}
          y={SVG_HEIGHT * 0.05}
          width={SVG_WIDTH * 0.64}
          height={SVG_HEIGHT * 0.70}
          rx={SVG_WIDTH * 0.20}
          fill="url(#stageLight)"
        />

        {/* ── Terrain zones (subtle fill + sketched outlines) ── */}
        {venueTerrainZones.map((zone) => (
          <SvgPolygon
            key={zone.id}
            points={toPoints(zone.polygon)}
            fill={terrainFill[zone.type] ?? 'transparent'}
            stroke={terrainStroke[zone.type] ?? 'transparent'}
            strokeWidth={0.8 * STROKE_SCALE}
            strokeDasharray={`${4 * STROKE_SCALE},${3 * STROKE_SCALE}`}
          />
        ))}

        {/* ── Elevation bands — 3 intentional contours: summit / mid / base ── */}
        {[
          { y: 0.18, amp: 20, phase: 0.15, op: 0.05 },
          { y: 0.48, amp: 30, phase: 0.40, op: 0.06 },
          { y: 0.76, amp: 18, phase: 0.25, op: 0.04 },
        ].map((c, i) => {
          const baseY = SVG_HEIGHT * c.y;
          const px = SVG_WIDTH * c.phase;
          return (
            <Path
              key={`contour-${i}`}
              d={`M-20,${baseY} Q${px + SVG_WIDTH * 0.2},${baseY - c.amp} ${SVG_WIDTH * 0.48},${baseY + c.amp * 0.5} Q${SVG_WIDTH * 0.72},${baseY + c.amp * 0.7} ${SVG_WIDTH + 20},${baseY - c.amp * 0.35}`}
              stroke={`rgba(30, 40, 52, ${c.op})`}
              strokeWidth={0.7 * STROKE_SCALE}
              fill="none"
            />
          );
        })}

        {/* ── Lift line ── */}
        {firstLift && <Line
          x1={liftBottom.x}
          y1={liftBottom.y}
          x2={liftTop.x}
          y2={liftTop.y}
          stroke="rgba(60, 60, 76, 0.25)"
          strokeWidth={2 * STROKE_SCALE}
          strokeDasharray={`${8 * STROKE_SCALE},${6 * STROKE_SCALE}`}
          strokeLinecap="round"
        />}

        {/* ── Selected trail outer halo (wide soft aura) ── */}
        {selectedTrailId && venueTrailGeo.map((geo: TrailGeo) => {
          if (geo.trailId !== selectedTrailId) return null;
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;
          const official = venueTrails.find((o) => o.id === geo.trailId);
          const lineColor = getTrailColor(official?.colorClass, trail.difficulty);
          const pathD = toPath(geo.polyline);
          return (
            <Path
              key={`outerGlow-${geo.trailId}`}
              d={pathD}
              stroke={lineColor}
              strokeWidth={trailLineWidth.selectedOuterGlow * STROKE_SCALE}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={trailGlowOpacity.selectedOuter}
            />
          );
        })}

        {/* ── Trail glow layers ── */}
        {venueTrailGeo.map((geo: TrailGeo) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;
          const isSelected = selectedTrailId === geo.trailId;
          const isDimmed = selectedTrailId !== null && !isSelected;
          if (isDimmed) return null;

          const official = venueTrails.find((o) => o.id === geo.trailId);
          const lineColor = getTrailColor(official?.colorClass, trail.difficulty);
          const pathD = toPath(geo.polyline);

          return (
            <Path
              key={`glow-${geo.trailId}`}
              d={pathD}
              stroke={lineColor}
              strokeWidth={
                (isSelected ? trailLineWidth.selectedGlow : trailLineWidth.glow) * STROKE_SCALE
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={isSelected ? trailGlowOpacity.selected : trailGlowOpacity.default}
            />
          );
        })}

        {/* ── Trail shadow layers ── */}
        {venueTrailGeo.map((geo: TrailGeo) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;
          const isSelected = selectedTrailId === geo.trailId;
          const isDimmed = selectedTrailId !== null && !isSelected;
          if (isDimmed) return null;

          const pathD = toPath(geo.polyline);

          return (
            <Path
              key={`shadow-${geo.trailId}`}
              d={pathD}
              stroke="rgba(0,0,0,0.55)"
              strokeWidth={
                (isSelected ? trailLineWidth.selectedShadow : trailLineWidth.shadow) * STROKE_SCALE
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          );
        })}

        {/* ── Trail hero lines ── */}
        {venueTrailGeo.map((geo: TrailGeo) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;
          const isSelected = selectedTrailId === geo.trailId;
          const isDimmed = selectedTrailId !== null && !isSelected;
          const official = venueTrails.find((o) => o.id === geo.trailId);
          const lineColor = getTrailColor(official?.colorClass, trail.difficulty);
          const pathD = toPath(geo.polyline);

          return (
            <Path
              key={`hero-${geo.trailId}`}
              d={pathD}
              stroke={lineColor}
              strokeWidth={
                (isSelected
                  ? trailLineWidth.selected
                  : isDimmed
                    ? trailLineWidth.dimmed
                    : trailLineWidth.default) * STROKE_SCALE
              }
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity={
                isSelected
                  ? trailLineOpacity.selected
                  : isDimmed
                    ? trailLineOpacity.dimmed
                    : trailLineOpacity.default
              }
            />
          );
        })}

        {/* ── Connection line: rider → selected start gate ── */}
        {riderPosition && selectedTrailId && (() => {
          const geo = venueTrailGeo.find((t) => t.trailId === selectedTrailId);
          if (!geo) return null;
          const rp = toSvg(riderPosition.latitude, riderPosition.longitude);
          const sp = toSvg(geo.startZone.latitude, geo.startZone.longitude);
          // Only show if rider is within SVG bounds (roughly)
          if (rp.x < -50 || rp.x > SVG_WIDTH + 50 || rp.y < -50 || rp.y > SVG_HEIGHT + 50) return null;
          return (
            <Line
              x1={rp.x} y1={rp.y}
              x2={sp.x} y2={sp.y}
              stroke="rgba(0, 200, 255, 0.15)"
              strokeWidth={1.5 * STROKE_SCALE}
              strokeDasharray={`${6 * STROKE_SCALE},${4 * STROKE_SCALE}`}
              strokeLinecap="round"
            />
          );
        })()}

        {/* ── Rider position dot ── */}
        {riderPosition && (() => {
          const rp = toSvg(riderPosition.latitude, riderPosition.longitude);
          const dotR = 5 * STROKE_SCALE;
          const haloR = 12 * STROKE_SCALE;
          const outerR = 22 * STROKE_SCALE;
          return (
            <>
              {/* Outer pulse halo */}
              <Circle cx={rp.x} cy={rp.y} r={outerR} fill="rgba(0, 200, 255, 0.06)" />
              {/* Inner halo */}
              <Circle cx={rp.x} cy={rp.y} r={haloR} fill="rgba(0, 200, 255, 0.15)" />
              {/* Core dot */}
              <Circle cx={rp.x} cy={rp.y} r={dotR} fill="#00C8FF" />
              {/* White center */}
              <Circle cx={rp.x} cy={rp.y} r={dotR * 0.4} fill="#fff" />
            </>
          );
        })()}

        {/* ── Tap hit targets (topmost in SVG, invisible) ── */}
        {venueTrailGeo.map((geo: TrailGeo) => {
          const trail = trails.find((t) => t.id === geo.trailId);
          if (!trail) return null;
          const pathD = toPath(geo.polyline);

          return (
            <Path
              key={`hit-${geo.trailId}`}
              d={pathD}
              stroke="transparent"
              strokeWidth={trailLineWidth.hitTarget * STROKE_SCALE}
              fill="none"
              onPress={() => handleTrailPress(geo.trailId)}
            />
          );
        })}
      </Svg>

      {/* ═══ LABELS — positioned RN Views over SVG ═══ */}
      {containerSize.width > 0 && (
        <>
          {/* Arena label */}
          {(() => {
            // Position label near top of bounds
            const labelLat = venueBounds.latMax - (venueBounds.latMax - venueBounds.latMin) * 0.05;
            const labelLng = (venueBounds.lngMin + venueBounds.lngMax) / 2;
            const pos = toSvg(labelLat, labelLng);
            const screen = svgToScreen(pos.x, pos.y, containerSize.width, containerSize.height);
            return (
              <View style={[styles.arenaLabel, { left: screen.left, top: screen.top }]}>
                <Text style={styles.arenaLabelTitle}>{venue.name.toUpperCase()}</Text>
                <Text style={styles.arenaLabelSub}>
                  {venue.elevationM ? `${venue.elevationM}m · ` : ''}{venue.season.label}
                </Text>
              </View>
            );
          })()}

          {/* Lift label */}
          {firstLift && (() => {
            const screen = svgToScreen(liftMid.x, liftMid.y, containerSize.width, containerSize.height);
            return (
              <View style={[styles.liftLabel, { left: screen.left, top: screen.top }]}>
                <Text style={styles.liftLabelText}>{firstLift.label ?? 'LIFT'}</Text>
              </View>
            );
          })()}

          {/* Trail labels + start/finish markers */}
          {venueTrailGeo.map((geo: TrailGeo) => {
            const trail = trails.find((t) => t.id === geo.trailId);
            if (!trail) return null;

            const isSelected = selectedTrailId === geo.trailId;
            const isDimmed = selectedTrailId !== null && !isSelected;
            const isHot = hotTrailId === geo.trailId;
            const hasChallenge = challengeTrailId === geo.trailId;
            const official = venueTrails.find((o) => o.id === geo.trailId);
            const diffColor = getTrailColor(official?.colorClass, trail.difficulty);

            // Label position
            const labelCoord = geo.labelAnchor ?? geo.polyline[Math.floor(geo.polyline.length / 2)];
            const labelSvg = toSvg(labelCoord.latitude, labelCoord.longitude);
            const labelScreen = svgToScreen(labelSvg.x, labelSvg.y, containerSize.width, containerSize.height);

            // Start gate position
            const startSvg = toSvg(geo.startZone.latitude, geo.startZone.longitude);
            const startScreen = svgToScreen(startSvg.x, startSvg.y, containerSize.width, containerSize.height);

            // Finish gate position
            const finishSvg = toSvg(geo.finishZone.latitude, geo.finishZone.longitude);
            const finishScreen = svgToScreen(finishSvg.x, finishSvg.y, containerSize.width, containerSize.height);

            return (
              <View key={geo.trailId} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                {/* Start gate pulse ring (highlight) */}
                {isSelected && highlightStart && (
                  <Animated.View
                    style={[
                      styles.startPulseRing,
                      {
                        left: startScreen.left - 22,
                        top: startScreen.top - 22,
                        borderColor: diffColor,
                        transform: [{ scale: pulseScale }],
                        opacity: pulseOpacity,
                      },
                    ]}
                  />
                )}

                {/* Start gate marker */}
                <Pressable
                  style={[
                    styles.startMarker,
                    {
                      left: startScreen.left - 14,
                      top: startScreen.top - 14,
                      borderColor: diffColor,
                      backgroundColor: diffColor + '20',
                      opacity: isDimmed ? 0.25 : 1,
                    },
                  ]}
                  onPress={() => handleTrailPress(geo.trailId)}
                >
                  <Text style={[styles.startText, { color: diffColor }]}>S</Text>
                </Pressable>

                {/* Finish gate marker */}
                <View
                  style={[
                    styles.finishMarker,
                    {
                      left: finishScreen.left - 10,
                      top: finishScreen.top - 10,
                      borderColor: diffColor,
                      opacity: isDimmed ? 0.15 : isSelected ? 0.9 : 0.45,
                    },
                  ]}
                >
                  <View style={[styles.finishDot, { backgroundColor: diffColor }]} />
                </View>

                {/* Trail name label — centered via onLayout measurement */}
                {!isDimmed && (
                  <Pressable
                    style={[
                      styles.trailLabel,
                      {
                        left: labelScreen.left - (labelWidths[geo.trailId] ?? 50) / 2,
                        top: labelScreen.top - 13,
                      },
                      isSelected && styles.trailLabelSelected,
                      isSelected && { backgroundColor: diffColor, borderColor: diffColor },
                      !isSelected && { borderColor: diffColor + '50', backgroundColor: 'rgba(10,10,18,0.75)' },
                    ]}
                    onLayout={(e) => {
                      const w = e.nativeEvent.layout.width;
                      if (w > 0 && w !== labelWidths[geo.trailId]) {
                        setLabelWidths((prev) => ({ ...prev, [geo.trailId]: w }));
                      }
                    }}
                    onPress={() => handleTrailPress(geo.trailId)}
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
                      {official?.name ?? trail.name}
                    </Text>
                    {isHot && (
                      <View style={[styles.hotDot, isSelected && { backgroundColor: colors.bg }]} />
                    )}
                    {hasChallenge && !isHot && (
                      <View style={[styles.hotDot, { backgroundColor: colors.gold }, isSelected && { backgroundColor: colors.bg }]} />
                    )}
                  </Pressable>
                )}
              </View>
            );
          })}
        </>
      )}

      </Animated.View>

      {/* ═══ EDGE VIGNETTES — UI chrome blending ═══ */}
      <LinearGradient
        colors={[
          'rgba(7, 7, 16, 0.92)',
          'rgba(7, 7, 16, 0.50)',
          'rgba(7, 7, 16, 0.12)',
          'transparent',
        ]}
        style={[styles.vignette, styles.vignetteTop]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={[
          'transparent',
          'rgba(7, 7, 16, 0.12)',
          'rgba(7, 7, 16, 0.55)',
          'rgba(7, 7, 16, 0.94)',
        ]}
        style={[styles.vignette, styles.vignetteBottom]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(7, 7, 16, 0.55)', 'rgba(7, 7, 16, 0.12)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.sideVignette, styles.vignetteLeft]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(7, 7, 16, 0.12)', 'rgba(7, 7, 16, 0.55)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.sideVignette, styles.vignetteRight]}
        pointerEvents="none"
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════════
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070710',
  },

  // ── Vignettes ──
  vignette: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  vignetteTop: {
    top: 0,
    height: 140,
  },
  vignetteBottom: {
    bottom: 0,
    height: 120,
  },
  sideVignette: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  vignetteLeft: {
    left: 0,
    width: 60,
  },
  vignetteRight: {
    right: 0,
    width: 60,
  },

  // ── Arena label ──
  arenaLabel: {
    position: 'absolute',
    alignItems: 'center',
    transform: [{ translateX: -60 }],
  },
  arenaLabelTitle: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.30)',
    letterSpacing: 4,
  },
  arenaLabelSub: {
    ...typography.labelSmall,
    fontSize: 7,
    color: 'rgba(255, 255, 255, 0.12)',
    letterSpacing: 3,
    marginTop: 2,
  },

  // ── Lift label ──
  liftLabel: {
    position: 'absolute',
    backgroundColor: 'rgba(16, 16, 24, 0.7)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  liftLabelText: {
    fontFamily: 'Rajdhani_400Regular',
    fontSize: 7,
    color: 'rgba(80, 80, 96, 0.5)',
    letterSpacing: 3,
  },

  // ── Start gate pulse ring ──
  startPulseRing: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
  },

  // ── Start gate marker ──
  startMarker: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 11,
  },

  // ── Finish gate marker ──
  finishMarker: {
    position: 'absolute',
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

  // ── Trail label — centered via onLayout measurement ──
  trailLabel: {
    position: 'absolute' as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(10, 10, 18, 0.88)',
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  trailLabelSelected: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.sm + 2,
    borderWidth: 1.5,
  },
  trailDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  trailLabelText: {
    fontFamily: 'Rajdhani_400Regular',
    color: 'rgba(255, 255, 255, 0.55)',
    fontSize: 9,
    letterSpacing: 1.5,
    maxWidth: 120,
  },
  trailLabelTextSelected: {
    fontSize: 11,
    letterSpacing: 2,
    fontFamily: 'Rajdhani_700Bold',
    color: '#070710',
  },
  badge: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 7,
    color: colors.orange,
    letterSpacing: 1,
  },
  hotDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.orange,
  },
});
