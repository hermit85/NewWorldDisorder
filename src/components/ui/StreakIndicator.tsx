import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type StreakIndicatorProps = {
  days: number;
  mode?: 'safe' | 'warn';
  subtitle: string;
};

export const StreakIndicator = memo(function StreakIndicator({
  days,
  mode = 'safe',
  subtitle,
}: StreakIndicatorProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (mode !== 'warn') {
      opacity.value = 1;
      cancelAnimation(opacity);
      return;
    }

    opacity.value = withRepeat(
      withTiming(0.55, { duration: 2200 }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(opacity);
    };
  }, [mode, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={styles.icon}>🔥</Text>
      <View style={styles.copyBlock}>
        <Text style={styles.title}>{days} dni z rzędu</Text>
        <Text style={[styles.subtitle, mode === 'warn' && styles.subtitleWarn]}>
          {subtitle}
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: chunk9Spacing.cardChildGap,
    borderRadius: chunk9Radii.card,
    padding: chunk9Spacing.cardPaddingTight,
    backgroundColor: chunk9Colors.bg.surface,
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
  },
  icon: {
    fontSize: 20,
  },
  copyBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...chunk9Typography.stat19,
    color: chunk9Colors.text.primary,
  },
  subtitle: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.secondary,
  },
  subtitleWarn: {
    color: chunk9Colors.accent.emerald,
  },
});
