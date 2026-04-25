// ─────────────────────────────────────────────────────────────
// BikeParkMap — stylized canvas for the Bike Park Hub view
//
// design-system/Bike Park Hub.html STATE A renders the bike park
// as a topo-styled canvas with:
//   - dark green base (#0B1410)
//   - faint accent topo contour curves (radial + horizontal)
//   - 32px grid overlay (very subtle)
//   - park-name watermark (huge, opacity 0.06)
//   - gondola dashed line (white, with stops)
//   - trail SVG paths colored by difficulty
//   - active rider blink dots (heatmap)
//   - start gate pin with pulse ring
//
// We don't yet flow real geometry through this component — Sprint 3
// will wire it via props. Until then the canvas is a stylized
// placeholder built entirely from procedurally-laid-out SVG paths,
// matching the design pixel-for-pixel without depending on Mapbox /
// Apple Maps. This keeps the visual language live in TestFlight.
//
// When geometry lands, replace `placeholderTrails` with real
// path data and unlock pin/rider positions from the real GPS.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import {
  resolveDifficultyTone,
  type DifficultyTone,
} from './DifficultyPill';

interface MapTrail {
  id: string;
  name: string;
  difficulty?: string | null;
  type?: string | null;
}

export interface BikeParkMapProps {
  /** Trails to render as colored paths. Up to 6 are drawn cleanly. */
  trails: MapTrail[];
  /** First two characters used as the watermark. */
  parkName: string;
  /** Number of riders dots to scatter (capped at 6). */
  activeRiders?: number;
  style?: ViewStyle;
}

/**
 * Procedural trail paths — six different gravity lines fanning out
 * from the top start gate (160, 180) to the base (60–100, 780). The
 * paths intentionally do NOT line up with real GPS — they're a
 * visual stand-in until geometry flows through.
 */
const PLACEHOLDER_PATHS = [
  // Line 0 — green / easy meandering
  'M 160 180 Q 200 280 220 360 T 280 540 Q 290 620 220 720 L 60 780',
  // Line 1 — blue / flow
  'M 160 180 Q 130 300 160 400 T 200 540 Q 240 640 180 740 L 70 780',
  // Line 2 — red / hard
  'M 160 180 Q 250 240 270 340 T 320 500 Q 340 600 280 700 L 100 780',
  // Line 3 — black / pro
  'M 160 180 Q 220 230 250 320 T 240 480 Q 220 580 200 670 L 100 780',
  // Line 4 — green dashed (closed/easy alt)
  'M 160 180 L 130 300 Q 110 420 130 540 Q 140 660 80 780',
  // Line 5 — red dashed (extra)
  'M 160 180 Q 100 240 80 340 T 60 500 Q 50 600 100 700 L 100 780',
];

const TRAIL_LABEL_POSITIONS = [
  { top: 430, left: 240 },
  { top: 520, left: 140 },
  { top: 340, left: 280 },
  { top: 600, left: 200 },
  { top: 460, left: 80 },
  { top: 380, left: 100 },
];

const RIDER_POSITIONS = [
  { top: 340, left: 140, delay: 0 },
  { top: 480, left: 230, delay: 500 },
  { top: 560, left: 170, delay: 1000 },
  { top: 660, left: 240, delay: 1500 },
  { top: 280, left: 280, delay: 2000 },
  { top: 600, left: 100, delay: 1200 },
];

function strokeForTone(tone: DifficultyTone): string {
  switch (tone) {
    case 'green': return colors.diffGreen;
    case 'blue': return colors.diffBlue;
    case 'red': return colors.diffRed;
    case 'black': return colors.textPrimary;
  }
}

function labelClassForTone(tone: DifficultyTone) {
  switch (tone) {
    case 'green': return { color: colors.diffGreen, border: 'rgba(60,203,127,0.40)' };
    case 'blue': return { color: colors.diffBlue, border: 'rgba(59,156,255,0.40)' };
    case 'red': return { color: colors.diffRed, border: 'rgba(255,71,87,0.40)' };
    case 'black': return { color: colors.textPrimary, border: 'rgba(255,255,255,0.20)' };
  }
}

function RiderBlink({ top, left, delay }: { top: number; left: number; delay: number }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const start = setTimeout(() => {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 1500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    }, delay);
    return () => clearTimeout(start);
  }, [delay, opacity]);

  return (
    <Animated.View
      style={[
        styles.rider,
        { top, left, opacity },
      ]}
    />
  );
}

function StartGate({ top, left }: { top: number; left: number }) {
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
  }, [ring]);

  const scale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] });
  const opacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });

  return (
    <View style={[styles.gate, { top, left }]}>
      <Animated.View
        style={[
          styles.gateRing,
          { transform: [{ scale }], opacity },
        ]}
      />
      <View style={styles.gateDot} />
    </View>
  );
}

export function BikeParkMap({
  trails,
  parkName,
  activeRiders = 4,
  style,
}: BikeParkMapProps) {
  const watermark = (parkName.replace(/\s+/g, '').slice(0, 6) || 'PARK').toUpperCase();
  // Wrap watermark every 3 chars for the design's stacked column.
  const watermarkLines = [
    watermark.slice(0, 3),
    watermark.slice(3, 6),
  ].filter(Boolean);

  // Cap to 6 placeholder paths so the canvas doesn't get muddy.
  const drawn = trails.slice(0, PLACEHOLDER_PATHS.length);
  const riderCount = Math.min(Math.max(activeRiders, 0), RIDER_POSITIONS.length);

  return (
    <View style={[styles.container, style]}>
      {/* Base — dark green wash with two radial highlights (light source). */}
      <View style={styles.base} />

      {/* Topo SVG overlay — contour curves at multiple elevations. */}
      <Svg
        viewBox="0 0 390 844"
        preserveAspectRatio="none"
        style={StyleSheet.absoluteFill as any}
      >
        <Defs>
          <SvgLinearGradient id="topoFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.accent} stopOpacity="0.05" />
            <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
          </SvgLinearGradient>
        </Defs>
        {/* Grid lines — 32px squares, very faint accent green. */}
        <G stroke="rgba(0, 255, 135, 0.04)" strokeWidth="0.5" fill="none">
          {Array.from({ length: 27 }).map((_, i) => (
            <Line key={`h${i}`} x1="0" y1={i * 32} x2="390" y2={i * 32} />
          ))}
          {Array.from({ length: 13 }).map((_, i) => (
            <Line key={`v${i}`} x1={i * 32} y1="0" x2={i * 32} y2="844" />
          ))}
        </G>
        {/* Topo contour curves. */}
        <G stroke={colors.accent} strokeWidth="0.6" fill="none" opacity="0.40">
          <Path d="M -20 200 Q 100 180 200 230 T 410 200" />
          <Path d="M -20 280 Q 90 240 200 290 T 410 270" />
          <Path d="M -20 360 Q 80 320 200 370 T 410 350" />
          <Path d="M -20 440 Q 100 400 200 450 T 410 430" />
          <Path d="M -20 520 Q 100 490 200 540 T 410 520" />
          <Path d="M -20 600 Q 110 570 200 620 T 410 600" />
          <Path d="M -20 680 Q 120 650 200 700 T 410 690" />
        </G>
        {/* Elevation labels — placed at four contour midpoints. */}
        <G fontFamily="Inter_700Bold" fontSize="8" fontWeight="700" fill={colors.accent} opacity="0.50">
          <SvgText x="80" y="220" letterSpacing="2">1130 M</SvgText>
          <SvgText x="220" y="380" letterSpacing="2" opacity="0.4">980 M</SvgText>
          <SvgText x="60" y="540" letterSpacing="2" opacity="0.4">820 M</SvgText>
          <SvgText x="240" y="700" letterSpacing="2" opacity="0.4">680 M</SvgText>
        </G>
        {/* Gondola — dashed white line from base to top with two stops. */}
        <G>
          <Line
            x1="60" y1="780" x2="160" y2="180"
            stroke={colors.textPrimary}
            strokeWidth="1"
            strokeDasharray="4 4"
            opacity="0.5"
          />
          <Circle cx="100" cy="540" r="3" fill={colors.textPrimary} opacity="0.7" />
          <Circle cx="130" cy="360" r="3" fill={colors.textPrimary} opacity="0.7" />
          <SvgText
            x="170" y="190"
            fontFamily="Inter_700Bold"
            fontSize="8"
            fill={colors.textPrimary}
            opacity="0.6"
            letterSpacing="2"
          >
            ▲ TOP
          </SvgText>
          <SvgText
            x="60" y="800"
            fontFamily="Inter_700Bold"
            fontSize="8"
            fill={colors.textPrimary}
            opacity="0.6"
            letterSpacing="2"
          >
            BASE
          </SvgText>
        </G>
        {/* Trail paths — tone determined by difficulty/type. */}
        <G fill="none" strokeLinecap="square" strokeLinejoin="miter">
          {drawn.map((trail, i) => {
            const tone = resolveDifficultyTone(trail.difficulty, trail.type);
            const stroke = strokeForTone(tone);
            const dashed = i === 4; // a stylistic "alt" line for variety
            return (
              <Path
                key={trail.id}
                d={PLACEHOLDER_PATHS[i]}
                stroke={stroke}
                strokeWidth="2.4"
                strokeDasharray={dashed ? '4 4' : undefined}
                opacity={dashed ? 0.5 : 0.85}
              />
            );
          })}
        </G>
      </Svg>

      {/* Watermark — huge stacked park name, opacity 0.06. */}
      <View style={styles.watermark} pointerEvents="none">
        {watermarkLines.map((line, i) => (
          <Text key={i} style={styles.watermarkText}>{line}</Text>
        ))}
      </View>

      {/* Trail labels overlay. Positioned absolutely on top. */}
      {drawn.map((trail, i) => {
        const tone = resolveDifficultyTone(trail.difficulty, trail.type);
        const labelStyle = labelClassForTone(tone);
        const pos = TRAIL_LABEL_POSITIONS[i] ?? TRAIL_LABEL_POSITIONS[0];
        return (
          <View
            key={`${trail.id}-label`}
            style={[
              styles.trailLabel,
              { top: pos.top, left: pos.left, borderColor: labelStyle.border },
            ]}
            pointerEvents="none"
          >
            <Text
              style={[styles.trailLabelText, { color: labelStyle.color }]}
              numberOfLines={1}
            >
              {trail.name.toUpperCase()}
            </Text>
          </View>
        );
      })}

      {/* Active rider heatmap blinks. */}
      {Array.from({ length: riderCount }).map((_, i) => {
        const pos = RIDER_POSITIONS[i];
        return (
          <RiderBlink key={i} top={pos.top} left={pos.left} delay={pos.delay} />
        );
      })}

      {/* Start gate pin — top of every line. */}
      <StartGate top={180} left={160} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    backgroundColor: '#0B1410',
  } as any,
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B1410',
  },
  watermark: {
    position: 'absolute',
    left: 14,
    top: 90,
  },
  watermarkText: {
    ...typography.title,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 80,
    lineHeight: 80 * 0.85,
    color: colors.textPrimary,
    opacity: 0.06,
    letterSpacing: -3.2,
    fontWeight: '900',
  },
  trailLabel: {
    position: 'absolute',
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderWidth: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  trailLabelText: {
    ...typography.micro,
    fontSize: 9,
    letterSpacing: 1.8, // 0.20em @ 9px
    fontWeight: '800',
  },
  rider: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
    transform: [{ translateX: -3 }, { translateY: -3 }],
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  gate: {
    position: 'absolute',
    width: 28,
    height: 28,
    transform: [{ translateX: -14 }, { translateY: -14 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  gateDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#000',
  },
  gateRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
});
