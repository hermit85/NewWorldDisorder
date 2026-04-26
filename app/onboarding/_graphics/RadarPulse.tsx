// ═══════════════════════════════════════════════════════════
// RadarPulse — slide 04 (GPS gate) hero visual.
//
// 200×200 SVG. Three concentric rings + a centred dot. The two
// outer rings expand + fade on a 1.6s loop (offset by half a
// period so the second ripple kicks in mid-cycle). Static inner
// ring + dot stay solid — they read as "you" in the centre of
// the radar sweep.
// ═══════════════════════════════════════════════════════════

import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/theme/colors';

const SIZE = 200;
const CENTRE = SIZE / 2;
const INNER_RING = 28;
const MID_RING = 60;
const OUTER_RING = 92;

export const RadarPulse = memo(function RadarPulse() {
  const ripple1 = useSharedValue(0);
  const ripple2 = useSharedValue(0);

  useEffect(() => {
    ripple1.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
    ripple2.value = withDelay(
      800,
      withRepeat(
        withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(ripple1);
      cancelAnimation(ripple2);
    };
  }, [ripple1, ripple2]);

  const ripple1Style = useAnimatedStyle(() => ({
    opacity: 0.6 - ripple1.value * 0.6,
    transform: [{ scale: 0.4 + ripple1.value * 0.6 }],
  }));

  const ripple2Style = useAnimatedStyle(() => ({
    opacity: 0.6 - ripple2.value * 0.6,
    transform: [{ scale: 0.4 + ripple2.value * 0.6 }],
  }));

  return (
    <View style={styles.wrap}>
      {/* Static rings + centre dot */}
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={CENTRE}
          cy={CENTRE}
          r={OUTER_RING}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.18}
          strokeWidth={1}
        />
        <Circle
          cx={CENTRE}
          cy={CENTRE}
          r={MID_RING}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.28}
          strokeWidth={1}
        />
        <Circle
          cx={CENTRE}
          cy={CENTRE}
          r={INNER_RING}
          fill="none"
          stroke={colors.accent}
          strokeOpacity={0.55}
          strokeWidth={1.5}
        />
        <Circle cx={CENTRE} cy={CENTRE} r={5} fill={colors.accent} />
      </Svg>

      {/* Animated ripples */}
      <Animated.View style={[styles.ripple, ripple1Style]} />
      <Animated.View style={[styles.ripple, ripple2Style]} />
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
    width: OUTER_RING * 2,
    height: OUTER_RING * 2,
    borderRadius: OUTER_RING,
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
});
