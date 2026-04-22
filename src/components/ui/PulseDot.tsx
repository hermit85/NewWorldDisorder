import { memo, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { chunk9Colors } from '@/theme/chunk9';

type PulseDotProps = {
  size?: 'sm' | 'md';
  color?: 'emerald';
};

const sizeMap = {
  sm: 6,
  md: 10,
} as const;

const colorMap = {
  emerald: chunk9Colors.accent.emerald,
} as const;

export const PulseDot = memo(function PulseDot({
  size = 'md',
  color = 'emerald',
}: PulseDotProps) {
  const pulseScale = useSharedValue(0.6);
  const pulseOpacity = useSharedValue(0.8);
  const diameter = sizeMap[size];
  const tint = colorMap[color];

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(2.4, {
          duration: 1800,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0.6, {
          duration: 0,
        }),
      ),
      -1,
      false,
    );

    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0, {
          duration: 1800,
          easing: Easing.out(Easing.quad),
        }),
        withTiming(0.8, {
          duration: 0,
        }),
      ),
      -1,
      false,
    );

    return () => {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
    };
  }, [pulseOpacity, pulseScale]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <View style={[styles.container, { width: diameter * 2.8, height: diameter * 2.8 }]}>
      <Animated.View
        style={[
          styles.pulse,
          pulseStyle,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: tint,
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: tint,
          },
        ]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
  },
  dot: {
    zIndex: 1,
  },
});
