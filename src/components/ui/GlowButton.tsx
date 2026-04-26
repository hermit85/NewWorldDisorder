import { memo, useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';

type GlowButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'inlineLink';
  disabled?: boolean;
};

export const GlowButton = memo(function GlowButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
}: GlowButtonProps) {
  const handlePress = useCallback(() => {
    if (disabled) return;
    // Spec v2 1.5: every CTA press fires minimum haptic.tap
    Haptics.selectionAsync().catch(() => undefined);
    onPress?.();
  }, [disabled, onPress]);

  if (variant === 'inlineLink') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [styles.inlineLink, pressed && !disabled && styles.inlineLinkPressed]}
      >
        <Text style={[styles.inlineLinkText, disabled && styles.disabledText]}>
          {label}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.buttonWrap, variant === 'primary' && styles.primaryWrap]}>
      {variant === 'primary' && Platform.OS === 'android' && <View style={styles.androidGlow} />}
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.buttonBase,
          variant === 'primary' ? styles.primaryButton : styles.secondaryButton,
          pressed && !disabled && styles.buttonPressed,
          disabled && styles.buttonDisabled,
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            variant === 'primary' ? styles.primaryText : styles.secondaryText,
            disabled && styles.disabledText,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  buttonWrap: {
    width: '100%',
    position: 'relative',
  },
  primaryWrap: {
    shadowColor: colors.accent,
    shadowOpacity: 0.42,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
  },
  androidGlow: {
    position: 'absolute',
    top: -1,
    right: -1,
    bottom: -1,
    left: -1,
    borderRadius: 17,
    backgroundColor: 'rgba(0,255,135,0.3)',
    opacity: 0.55,
    elevation: 8,
  },
  buttonBase: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 15,
    lineHeight: 18,
    letterSpacing: 2.6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  primaryText: {
    color: colors.bg,
  },
  secondaryText: {
    color: colors.accent,
  },
  inlineLink: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  inlineLinkPressed: {
    opacity: 0.75,
  },
  inlineLinkText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.86,
    textTransform: 'uppercase',
    color: colors.accent,
  },
  disabledText: {
    opacity: 0.8,
  },
});
