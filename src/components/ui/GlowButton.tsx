import { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

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
  if (variant === 'inlineLink') {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onPress}
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
        onPress={onPress}
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
    shadowColor: chunk9Colors.accent.emerald,
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
    borderRadius: chunk9Radii.button + 1,
    backgroundColor: 'rgba(0,255,135,0.3)',
    opacity: 0.55,
    elevation: 8,
  },
  buttonBase: {
    minHeight: chunk9Spacing.ctaHeight,
    borderRadius: chunk9Radii.button,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  primaryButton: {
    backgroundColor: chunk9Colors.accent.emerald,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: chunk9Colors.accent.emerald,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.96,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    ...chunk9Typography.label13,
    fontSize: chunk9Spacing.ctaFontSize,
    letterSpacing: 2.6,
    textAlign: 'center',
  },
  primaryText: {
    color: chunk9Colors.bg.base,
  },
  secondaryText: {
    color: chunk9Colors.accent.emerald,
  },
  inlineLink: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
  },
  inlineLinkPressed: {
    opacity: 0.75,
  },
  inlineLinkText: {
    ...chunk9Typography.label13,
    color: chunk9Colors.accent.emerald,
  },
  disabledText: {
    opacity: 0.8,
  },
});
