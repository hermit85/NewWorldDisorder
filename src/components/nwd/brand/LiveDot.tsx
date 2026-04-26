// ═══════════════════════════════════════════════════════════
// LiveDot — animated dot used across brand chrome.
//
// Three modes match the design-system "race state" cadence:
//   pulse     — ARMED (1.2s loop, opacity 1↔0.5, scale 1↔1.18)
//   verified  — slow breathe (2.4s loop, opacity 1↔0.85, scale 1↔1.06)
//   none      — static, no animation (idle / settled)
//
// Single sharedValue + derived opacity/scale keeps the animation
// graph minimal and matches the shipped onboarding rendering exactly.
// ═══════════════════════════════════════════════════════════

import { memo, useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';

export type LiveDotMode = 'pulse' | 'verified' | 'none';

export interface LiveDotProps {
  /** Diameter in px (NOT radius). Default 6. */
  size?: number;
  color?: string;
  mode?: LiveDotMode;
  /** Convenience: `false` forces mode='none'. Kept so older call sites compile. */
  animated?: boolean;
}

const TIMING: Record<Exclude<LiveDotMode, 'none'>, {
  duration: number;
  opacityRange: number;
  scaleRange: number;
}> = {
  pulse:    { duration: 1200, opacityRange: 0.5,  scaleRange: 0.18 },
  verified: { duration: 2400, opacityRange: 0.15, scaleRange: 0.06 },
};

export const LiveDot = memo(function LiveDot({
  size = 6,
  color = colors.accent,
  mode = 'pulse',
  animated = true,
}: LiveDotProps) {
  const effectiveMode: LiveDotMode = animated === false ? 'none' : mode;
  const progress = useSharedValue(0);

  useEffect(() => {
    if (effectiveMode === 'none') {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    const { duration } = TIMING[effectiveMode];
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [effectiveMode, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    if (effectiveMode === 'none') {
      return { opacity: 1, transform: [{ scale: 1 }] };
    }
    const { opacityRange, scaleRange } = TIMING[effectiveMode];
    return {
      opacity: 1 - progress.value * opacityRange,
      transform: [{ scale: 1 + progress.value * scaleRange }],
    };
  });

  return (
    <Animated.View
      style={[
        styles.dot,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        animatedStyle,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  dot: {},
});
