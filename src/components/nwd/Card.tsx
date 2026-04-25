// ─────────────────────────────────────────────────────────────
// Card — base e2 panel container (per ui.jsx Card)
//
// Default elevation: e2 (panel + hairline border).
// `hi` prop bumps to e3 (rowHot bg + borderMid). `glow` adds the
// soft accent shadow used on armed-row equivalents.
//
// Padding follows compact density (16) by default, override via
// `padding` prop.
// ─────────────────────────────────────────────────────────────
import { ReactNode, useCallback } from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { spacing, radii } from '@/theme/spacing';

export interface CardProps {
  children: ReactNode;
  /** Bump to e3 (rowHot bg + borderMid). */
  hi?: boolean;
  /** Add accent glow shadow (use for armed/active surfaces). */
  glow?: boolean;
  /** Override padding (default: spacing.pad = 16). */
  padding?: number;
  /** Override radius (default: radii.card = 18). */
  radius?: number;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({
  children,
  hi = false,
  glow = false,
  padding,
  radius,
  onPress,
  style,
}: CardProps) {
  const handlePress = useCallback(() => {
    if (!onPress) return;
    Haptics.selectionAsync().catch(() => undefined);
    onPress();
  }, [onPress]);

  const containerStyle = [
    styles.base,
    hi ? styles.hi : styles.default,
    glow && styles.glow,
    {
      padding: padding ?? spacing.pad,
      borderRadius: radius ?? radii.card,
    },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={handlePress}
        style={({ pressed }) => [
          ...containerStyle,
          pressed && { opacity: 0.92 },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
  },
  default: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
  },
  hi: {
    backgroundColor: colors.row,
    borderColor: colors.borderMid,
  },
  glow: {
    borderColor: colors.borderHot,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
});
