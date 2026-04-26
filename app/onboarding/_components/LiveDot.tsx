// ═══════════════════════════════════════════════════════════
// LiveDot — ARMED state pulse (1.2s loop, opacity 1→0.5,
// scale 1→1.18, easing inOut(quad)).
//
// Used as the "live indicator" alongside SEZON 01 · LIVE bands,
// scope-tab dots and side-of-headline indicators.
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

export interface LiveDotProps {
  size?: number;
  color?: string;
}

export const LiveDot = memo(function LiveDot({
  size = 6,
  color = colors.accent,
}: LiveDotProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.5,
    transform: [{ scale: 1 + progress.value * 0.18 }],
  }));

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
