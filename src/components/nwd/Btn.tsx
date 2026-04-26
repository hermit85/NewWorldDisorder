// ─────────────────────────────────────────────────────────────
// Btn — canonical NWD button (design-system/components.md § Btn)
//
// Anatomy: [Icon?]  LABEL TEXT
//   - primary: pill 999 radius, accent fill, accentInk text, glow
//   - ghost:   14px radius, transparent, hairline border, text color
//   - danger:  pill 999 radius, danger fill, white text
//
// Label always Rajdhani 800 +0.24em CAPS @ 11px (label token).
// Sizes: sm=32h, md=44h, lg=56h (full-width by default).
// Disabled: opacity 0.4, blocks taps, drops glow.
// Pressed: scale(0.98).
// ─────────────────────────────────────────────────────────────
import { ReactNode, useCallback } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';

export type BtnVariant = 'primary' | 'ghost' | 'danger';
export type BtnSize = 'sm' | 'md' | 'lg';

export interface BtnProps {
  variant?: BtnVariant;
  size?: BtnSize;
  /** Full-width by default; set false for inline. */
  fullWidth?: boolean;
  /** Optional left-side icon — accepts any ReactNode (use IconGlyph). */
  icon?: ReactNode;
  /** CAPS label — system uppercases via textTransform regardless. */
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Override haptic feedback (default: light for ghost, medium for primary, heavy for danger). */
  haptic?: 'none' | 'light' | 'medium' | 'heavy';
  style?: ViewStyle;
}

const SIZE_HEIGHT: Record<BtnSize, number> = { sm: 32, md: 44, lg: 56 };
const SIZE_FONT: Record<BtnSize, number> = { sm: 10, md: 11, lg: 12 };
const SIZE_PADDING: Record<BtnSize, number> = { sm: 14, md: 18, lg: 24 };

export function Btn({
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  icon,
  children,
  onPress,
  disabled = false,
  haptic,
  style,
}: BtnProps) {
  const handlePress = useCallback(() => {
    if (disabled || !onPress) return;
    const tone =
      haptic ??
      (variant === 'primary' ? 'medium' : variant === 'danger' ? 'heavy' : 'light');
    if (tone !== 'none') {
      const styleMap = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      Haptics.impactAsync(styleMap[tone]).catch(() => undefined);
    }
    onPress();
  }, [disabled, onPress, haptic, variant]);

  const height = SIZE_HEIGHT[size];
  const fontSize = SIZE_FONT[size];
  const horizPad = SIZE_PADDING[size];
  const isPill = variant !== 'ghost';
  const radius = isPill ? height / 2 : 14;

  const surface = (() => {
    if (variant === 'primary') return { bg: colors.accent, fg: colors.accentInk, border: 'transparent' };
    if (variant === 'danger') return { bg: colors.danger, fg: '#FFFFFF', border: 'transparent' };
    return { bg: 'transparent', fg: colors.textPrimary, border: colors.border };
  })();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          height,
          paddingHorizontal: horizPad,
          borderRadius: radius,
          backgroundColor: surface.bg,
          borderWidth: variant === 'ghost' ? 1 : 0,
          borderColor: surface.border,
          width: fullWidth ? '100%' : undefined,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : 1,
        },
        variant === 'primary' && !disabled && styles.primaryGlow,
        pressed && !disabled && { transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          {
            color: surface.fg,
            fontSize,
            // Rajdhani's tall ascent (allocated for Polish diacritics)
            // gets clipped when lineHeight ≤ fontSize. 1.2× gives the
            // glyph room to render without trimming top/bottom edges.
            lineHeight: fontSize * 1.2,
            letterSpacing: fontSize * 0.24,
          },
        ]}
        numberOfLines={1}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    // typography.label is calibrated for mono fonts (lineHeight === fontSize);
    // dropping the spread lets the inline lineHeight prop give Rajdhani enough
    // room. fontSize / lineHeight / letterSpacing are all set inline because
    // RN uses px (not em) and they vary per Btn size.
    fontFamily: 'Rajdhani_700Bold',
    fontWeight: '800',
    textTransform: 'uppercase',
    includeFontPadding: false,
  },
  primaryGlow: {
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 8,
  },
});

// Suppress unused — Animated reserved for future scale spring.
void Animated;
