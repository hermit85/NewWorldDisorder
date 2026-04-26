// ═══════════════════════════════════════════════════════════
// GateSchematic — slide 02 hero illustration.
//
// 360×440 SVG with:
//   - 4 corner brackets framing the canvas
//   - winding corridor path (3 stacked strokes for the
//     gradient halo + fill + dashed centre line)
//   - START line at top of corridor
//   - animated rider dot on the curve (ARMED pulse)
//   - timer panel overlay (CZAS · 01:29.76)
//   - corridor label '± 10 M' with leader line
//   - finish line at bottom + VERIFIED badge + label
//
// Path uses the spec-pinned coordinates so the hero stays
// pixel-stable between layouts.
// ═══════════════════════════════════════════════════════════

import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Line,
  Path,
  Pattern,
  Rect,
} from 'react-native-svg';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

const VIEW_W = 360;
const VIEW_H = 440;

// Spec-pinned corridor path (slide 02 hero).
const CORRIDOR_D = 'M 100 60 Q 130 120 110 180 Q 90 250 150 300 Q 200 330 200 340';

// Approximate xy of the rider dot ~midway along the corridor.
const RIDER_X = 110;
const RIDER_Y = 200;

export const GateSchematic = memo(function GateSchematic() {
  // ARMED pulse for both the rider dot halo + the VERIFIED badge.
  const armed = useSharedValue(0);
  const verified = useSharedValue(0);

  useEffect(() => {
    armed.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    verified.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(armed);
      cancelAnimation(verified);
    };
  }, [armed, verified]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.4 - armed.value * 0.2,
    transform: [{ scale: 1 + armed.value * 0.18 }],
  }));

  const verifiedStyle = useAnimatedStyle(() => ({
    opacity: 1 - verified.value * 0.15,
    transform: [{ scale: 1 + verified.value * 0.06 }],
  }));

  return (
    <View style={styles.container}>
      <Svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={StyleSheet.absoluteFillObject}>
        <Defs>
          {/* Subtle HUD scan-line pattern over the canvas */}
          <Pattern id="scanLines" x="0" y="0" width="3" height="3" patternUnits="userSpaceOnUse">
            <Rect width="3" height="0.5" fill={colors.textPrimary} fillOpacity="0.04" />
          </Pattern>
        </Defs>

        {/* Scan-line overlay (drawn first so it sits behind everything else) */}
        <Rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="url(#scanLines)" />

        {/* Corner brackets (4) — 14×14 with stroke 1.6 hairline */}
        <CornerBracket x={20} y={20} variant="tl" />
        <CornerBracket x={VIEW_W - 34} y={20} variant="tr" />
        <CornerBracket x={20} y={VIEW_H - 34} variant="bl" />
        <CornerBracket x={VIEW_W - 34} y={VIEW_H - 34} variant="br" />

        {/* Corridor halo — 44px solid accent @ 0.10 (RN-svg gradient was rendering as solid green banana on iOS) */}
        <Path d={CORRIDOR_D} stroke={colors.accent} strokeOpacity={0.10} strokeWidth={44} strokeLinecap="round" fill="none" />

        {/* Corridor middle — 36px accent @ 0.06 */}
        <Path d={CORRIDOR_D} stroke={colors.accent} strokeOpacity={0.06} strokeWidth={36} strokeLinecap="round" fill="none" />

        {/* Corridor inner — 24px accent @ 0.04 (subtler core) */}
        <Path d={CORRIDOR_D} stroke={colors.accent} strokeOpacity={0.04} strokeWidth={24} strokeLinecap="round" fill="none" />

        {/* Corridor centre line — 1.5px dashed white */}
        <Path
          d={CORRIDOR_D}
          stroke={colors.textPrimary}
          strokeOpacity={0.85}
          strokeWidth={1.5}
          strokeDasharray="4 4"
          strokeLinecap="square"
          fill="none"
        />

        {/* START line at top */}
        <Line x1={60} y1={60} x2={140} y2={60} stroke={colors.accent} strokeWidth={2} />

        {/* FINISH line at bottom */}
        <Line x1={160} y1={340} x2={240} y2={340} stroke={colors.accent} strokeWidth={2} />

        {/* Corridor label leader line (right of mid-curve) */}
        <Line x1={170} y1={210} x2={250} y2={210} stroke={colors.textTertiary} strokeWidth={1} strokeDasharray="3 3" />
      </Svg>

      {/* START label */}
      <View style={[styles.absLabel, { top: 36, left: 56 }]}>
        <Text style={styles.startLabel}>START</Text>
      </View>

      {/* Corridor label '± 10 M' */}
      <View style={[styles.absLabel, { top: 198, left: 256 }]}>
        <Text style={styles.corridorLabel}>KORYTARZ ± 10 M</Text>
      </View>

      {/* Animated rider dot + halo */}
      <View style={[styles.absLabel, { top: RIDER_Y - 12, left: RIDER_X - 12 }]}>
        <Animated.View style={[styles.riderHalo, haloStyle]} />
        <View style={styles.riderDot} />
      </View>

      {/* Timer overlay panel — middle right */}
      <View style={styles.timerPanel}>
        <Text style={styles.timerLabel}>CZAS</Text>
        <Text style={styles.timerValue}>01:29.76</Text>
      </View>

      {/* VERIFIED badge — circle at finish line */}
      <Animated.View style={[styles.verifiedBadge, verifiedStyle]}>
        <Svg width={20} height={20} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={10} fill={colors.accent} />
          <Path
            d="M 7 12 L 11 16 L 17 9"
            fill="none"
            stroke={colors.accentInk}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      {/* META · ZALICZONY label below finish */}
      <View style={[styles.absLabel, { top: 360, left: 142 }]}>
        <Text style={styles.metaLabel}>META · ZALICZONY</Text>
      </View>
    </View>
  );
});

function CornerBracket({
  x,
  y,
  variant,
}: {
  x: number;
  y: number;
  variant: 'tl' | 'tr' | 'bl' | 'br';
}) {
  // 14×14 corner ticks. Each variant draws two short lines
  // forming an L pointing outward.
  const stroke = colors.border;
  const sw = 1.5;
  const len = 14;
  switch (variant) {
    case 'tl':
      return (
        <>
          <Line x1={x} y1={y} x2={x + len} y2={y} stroke={stroke} strokeWidth={sw} />
          <Line x1={x} y1={y} x2={x} y2={y + len} stroke={stroke} strokeWidth={sw} />
        </>
      );
    case 'tr':
      return (
        <>
          <Line x1={x + len} y1={y} x2={x} y2={y} stroke={stroke} strokeWidth={sw} />
          <Line x1={x + len} y1={y} x2={x + len} y2={y + len} stroke={stroke} strokeWidth={sw} />
        </>
      );
    case 'bl':
      return (
        <>
          <Line x1={x} y1={y + len} x2={x + len} y2={y + len} stroke={stroke} strokeWidth={sw} />
          <Line x1={x} y1={y + len} x2={x} y2={y} stroke={stroke} strokeWidth={sw} />
        </>
      );
    case 'br':
      return (
        <>
          <Line x1={x + len} y1={y + len} x2={x} y2={y + len} stroke={stroke} strokeWidth={sw} />
          <Line x1={x + len} y1={y + len} x2={x + len} y2={y} stroke={stroke} strokeWidth={sw} />
        </>
      );
  }
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: VIEW_W / VIEW_H,
    position: 'relative',
  },
  absLabel: {
    position: 'absolute',
  },
  startLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2.2,
    color: colors.accent,
  },
  corridorLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 1.6,
    color: colors.textTertiary,
  },
  metaLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 2.2,
    color: colors.accent,
  },
  riderHalo: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent,
  },
  riderDot: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  timerPanel: {
    position: 'absolute',
    top: 240,
    right: 12,
    width: 118,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,255,135,0.45)',
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  timerLabel: {
    fontFamily: fonts.mono,
    fontSize: 8,
    lineHeight: 10,
    letterSpacing: 1.6,
    color: colors.textTertiary,
  },
  timerValue: {
    fontFamily: fonts.racing,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.4,
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  verifiedBadge: {
    position: 'absolute',
    top: 326,
    left: 192,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
