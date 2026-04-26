// ═══════════════════════════════════════════════════════════
// AmbientScan — slow, low-opacity horizontal line that sweeps
// top→bottom on a 4.2s loop. Sits on the screen background;
// pointer-events disabled. The "alive HUD" feel without any
// content competition.
//
// One of the four motion tokens design-system/tokens.ts wires up
// (scanAmbient) — finally lit up here. Use on tab screens
// (Home / Spoty / Ranking / Rider) as the ambient atmosphere
// layer.
// ═══════════════════════════════════════════════════════════

import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { motion } from '@/theme/motion';

export interface AmbientScanProps {
  /** Loop duration in ms. Defaults to scanAmbient (4200ms). */
  duration?: number;
  /** Peak opacity at mid-sweep. Default 0.05. */
  opacity?: number;
  /** Line color. Defaults to text-primary (off-white). */
  color?: string;
  /** Line thickness in px. Default 2. */
  thickness?: number;
}

export function AmbientScan({
  duration = motion.scanAmbient,
  opacity = 0.05,
  color,
  thickness = 2,
}: AmbientScanProps) {
  const screenHeight = Dimensions.get('window').height;
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [duration, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    // Sweep from -10% above screen to 110% below; sin peak at mid
    // keeps the line invisible near top/bottom edges so the loop
    // doesn't "snap" back visibly.
    const sineFade = Math.sin(progress.value * Math.PI);
    return {
      transform: [
        { translateY: -screenHeight * 0.1 + progress.value * screenHeight * 1.2 },
      ],
      opacity: opacity * (sineFade > 0 ? sineFade : 0),
    };
  });

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <Animated.View
        style={[
          styles.line,
          {
            backgroundColor: color ?? colors.textPrimary,
            height: thickness,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
});
