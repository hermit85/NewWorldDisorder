// ─────────────────────────────────────────────────────────────
// Pill — canonical NWD state badge
//
// design-system/components.md § Pill + patterns.md § Pattern 1.
// State-aware: training / armed / verified / pending / invalid /
// neutral. Maps to colors.state* tokens. Optional leading dot
// animates per state semantics.
//
// Anatomy: [●]  LABEL
//   - Height: 22
//   - Padding: 4 × 10
//   - Radius: pill 999
//   - Border: 1px state@40%
//   - Background: state@14%
//   - Label: micro 10px mono CAPS in state color
//   - Dot: 6×6 — animated for armed (1.2s pulse) / pending (0.6s blink)
//
// Reuses everywhere a run state is shown — leaderboard row, profile
// history, run summary, trail card. Per § Pattern 1 a row that IS
// in armed state gets elevation.e4 (rowHot+borderHot+glowSoft) PLUS
// the armed pill — the pill is the affordance, the row is the canvas.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export type PillState =
  | 'training'
  | 'armed'
  | 'verified'
  | 'pending'
  | 'invalid'
  | 'neutral'
  | 'accent';

export interface PillProps {
  state?: PillState;
  /** Show leading 6×6 dot (animated for armed/verified/pending). */
  dot?: boolean;
  /** CAPS-rendered automatically. */
  children: string;
  size?: 'xs' | 'sm' | 'md';
  style?: ViewStyle;
}

const STATE_PRESETS: Record<PillState, { fg: string; bg: string; border: string }> = {
  training: {
    fg: colors.stateTraining,
    bg: 'rgba(242, 244, 243, 0.06)',
    border: 'rgba(242, 244, 243, 0.18)',
  },
  armed: {
    fg: colors.stateArmed,
    bg: 'rgba(0, 255, 135, 0.14)',
    border: 'rgba(0, 255, 135, 0.40)',
  },
  verified: {
    fg: colors.stateVerified,
    bg: 'rgba(0, 255, 135, 0.14)',
    border: 'rgba(0, 255, 135, 0.40)',
  },
  pending: {
    fg: colors.statePending,
    bg: 'rgba(255, 176, 32, 0.14)',
    border: 'rgba(255, 176, 32, 0.40)',
  },
  invalid: {
    fg: colors.stateInvalid,
    bg: 'rgba(255, 71, 87, 0.14)',
    border: 'rgba(255, 71, 87, 0.40)',
  },
  neutral: {
    fg: colors.textSecondary,
    bg: 'transparent',
    border: colors.border,
  },
  accent: {
    fg: colors.accent,
    bg: colors.accentDim,
    border: colors.borderHot,
  },
};

const SIZE: Record<NonNullable<PillProps['size']>, { h: number; px: number; fs: number; gap: number }> = {
  xs: { h: 18, px: 8, fs: 9, gap: 5 },
  sm: { h: 22, px: 10, fs: 10, gap: 6 },
  md: { h: 26, px: 12, fs: 11, gap: 7 },
};

function StateDot({ color, state }: { color: string; state: PillState }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === 'armed') {
      // 1.2s ease-in-out pulse
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.55, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
      // Expanding ring
      Animated.loop(
        Animated.timing(ring, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ).start();
    } else if (state === 'verified') {
      // 2.4s ease-in-out breathe
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.85, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      ).start();
    } else if (state === 'pending') {
      // 0.6s linear blink
      Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.35, duration: 300, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 300, easing: Easing.linear, useNativeDriver: true }),
        ]),
      ).start();
    }
  }, [state, opacity, ring]);

  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [1, 3] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={styles.dotWrap}>
      {state === 'armed' && (
        <Animated.View
          style={[
            styles.dotRing,
            { backgroundColor: color, opacity: ringOpacity, transform: [{ scale: ringScale }] },
          ]}
        />
      )}
      <Animated.View
        style={[styles.dotFill, { backgroundColor: color, opacity }]}
      />
    </View>
  );
}

export function Pill({
  state = 'neutral',
  dot = false,
  children,
  size = 'sm',
  style,
}: PillProps) {
  const preset = STATE_PRESETS[state];
  const dim = SIZE[size];

  return (
    <View
      style={[
        styles.base,
        {
          height: dim.h,
          paddingHorizontal: dim.px,
          gap: dim.gap,
          backgroundColor: preset.bg,
          borderColor: preset.border,
        },
        style,
      ]}
    >
      {dot && <StateDot color={preset.fg} state={state} />}
      <Text
        style={[
          styles.label,
          { color: preset.fg, fontSize: dim.fs, letterSpacing: dim.fs * 0.20 },
        ]}
        numberOfLines={1}
      >
        {children.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  label: {
    ...typography.micro,
    fontWeight: '800',
    fontFamily: 'Rajdhani_700Bold',
    textTransform: 'uppercase',
  },
  dotWrap: {
    width: 6,
    height: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotFill: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotRing: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
