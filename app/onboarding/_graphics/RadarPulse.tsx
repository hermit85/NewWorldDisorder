// ═══════════════════════════════════════════════════════════
// RadarPulse — slide 04 (GPS gate) hero visual.
//
// 280×280 SVG canvas. Per v9 mockup:
//   - 4 static rings at r=40/70/100/130, descending opacity, last
//     two dashed for the "long-range scan" effect
//   - 4 crosshair lines extending from inner gap to canvas edge
//   - centre 6px filled accent dot + 12px ring (armed pulse)
//   - 3 expanding ripples on a 2.4s loop, offset 0/0.8/1.6s, that
//     scale 0.4 → 1 and fade 0.6 → 0
//   - "GPS · 24 SAT" mono label under the radar centre
// ═══════════════════════════════════════════════════════════

import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

const SIZE = 280;
const CENTRE = SIZE / 2;
const RING_BASE = 30;
const RING_MAX = 110;

export const RadarPulse = memo(function RadarPulse() {
  const armed = useSharedValue(0);
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);
  const ripple3 = useSharedValue(0);

  useEffect(() => {
    armed.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    const ripple = () =>
      withRepeat(
        withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    ripple1.value = ripple();
    ripple2.value = withDelay(800, ripple());
    ripple3.value = withDelay(1600, ripple());
    return () => {
      cancelAnimation(armed);
      cancelAnimation(ripple1);
      cancelAnimation(ripple2);
      cancelAnimation(ripple3);
    };
  }, [armed, ripple1, ripple2, ripple3]);

  const armedRingStyle = useAnimatedStyle(() => ({
    opacity: 1 - armed.value * 0.5,
    transform: [{ scale: 1 + armed.value * 0.18 }],
  }));

  const ripple1Style = useAnimatedStyle(() => ({
    opacity: 0.6 - ripple1.value * 0.6,
    transform: [{ scale: 0.4 + ripple1.value * 0.6 }],
  }));

  const ripple2Style = useAnimatedStyle(() => ({
    opacity: 0.6 - ripple2.value * 0.6,
    transform: [{ scale: 0.4 + ripple2.value * 0.6 }],
  }));

  const ripple3Style = useAnimatedStyle(() => ({
    opacity: 0.6 - ripple3.value * 0.6,
    transform: [{ scale: 0.4 + ripple3.value * 0.6 }],
  }));

  return (
    <View style={styles.wrap}>
      {/* Static rings + crosshair + centre dot (SVG) */}
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Static rings — 4 levels, last two dashed */}
        <Circle cx={CENTRE} cy={CENTRE} r={40} fill="none" stroke={colors.accent} strokeOpacity={0.15} strokeWidth={1} />
        <Circle cx={CENTRE} cy={CENTRE} r={70} fill="none" stroke={colors.accent} strokeOpacity={0.10} strokeWidth={1} />
        <Circle cx={CENTRE} cy={CENTRE} r={100} fill="none" stroke={colors.accent} strokeOpacity={0.06} strokeWidth={1} strokeDasharray="4 4" />
        <Circle cx={CENTRE} cy={CENTRE} r={130} fill="none" stroke={colors.accent} strokeOpacity={0.04} strokeWidth={1} strokeDasharray="2 4" />

        {/* Crosshair (4 short segments from edge → near centre) */}
        <Line x1={0} y1={CENTRE} x2={CENTRE - 50} y2={CENTRE} stroke={colors.accent} strokeOpacity={0.20} strokeWidth={0.5} />
        <Line x1={CENTRE + 50} y1={CENTRE} x2={SIZE} y2={CENTRE} stroke={colors.accent} strokeOpacity={0.20} strokeWidth={0.5} />
        <Line x1={CENTRE} y1={0} x2={CENTRE} y2={CENTRE - 50} stroke={colors.accent} strokeOpacity={0.20} strokeWidth={0.5} />
        <Line x1={CENTRE} y1={CENTRE + 50} x2={CENTRE} y2={SIZE} stroke={colors.accent} strokeOpacity={0.20} strokeWidth={0.5} />

        {/* Centre dot (static fill) */}
        <Circle cx={CENTRE} cy={CENTRE} r={6} fill={colors.accent} />
      </Svg>

      {/* Animated ripples (View ring with border) */}
      <Animated.View style={[styles.ripple, ripple1Style]} />
      <Animated.View style={[styles.ripple, ripple2Style]} />
      <Animated.View style={[styles.ripple, ripple3Style]} />

      {/* Armed centre ring (pulses around the centre dot) */}
      <Animated.View style={[styles.armedRing, armedRingStyle]} />

      {/* "GPS · 24 SAT" mono label below centre */}
      <Text style={styles.satLabel}>GPS · 24 SAT</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ripple: {
    position: 'absolute',
    width: RING_MAX * 2,
    height: RING_MAX * 2,
    borderRadius: RING_MAX,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  armedRing: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  satLabel: {
    position: 'absolute',
    bottom: 10,
    fontFamily: fonts.mono,
    fontSize: 9,
    letterSpacing: 3,
    color: 'rgba(0, 255, 135, 0.6)',
    textTransform: 'uppercase',
  },
});
