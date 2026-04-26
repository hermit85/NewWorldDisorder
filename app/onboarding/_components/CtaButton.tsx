// ═══════════════════════════════════════════════════════════
// CtaButton — full-width accent pill with press scale 1→0.96.
//
// Locked at the same Y position across all 3 slides; the slides
// supply identical bottom padding so the CTA never jumps.
// ═══════════════════════════════════════════════════════════

import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface CtaButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export const CtaButton = memo(function CtaButton({
  label,
  onPress,
  disabled = false,
}: CtaButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.96, { duration: 100, easing: Easing.out(Easing.quad) });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 100, easing: Easing.out(Easing.quad) });
  }, [scale]);

  const handlePress = useCallback(() => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  }, [disabled, onPress]);

  return (
    <Animated.View style={[styles.wrap, animatedStyle, disabled && styles.disabled]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.pressable}
      >
        <Text style={styles.label}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 3,
    color: colors.accentInk,
    textTransform: 'uppercase',
  },
});
