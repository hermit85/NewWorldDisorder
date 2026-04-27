// ═══════════════════════════════════════════════════════════
// RiderIdCard — hero "passport" identity block for the Rider tab.
//
// Top-tier framing: profile is not a settings page, it's a rider
// ID card. Big rider tag, rank label, venue-of-record, and an
// avatar with a slow-breathe accent ring (`pulseVerified` motion
// token — verified-state cadence, the rider IS verified by being
// in the league).
//
// Renders avatar slot as a node so consumers can drop in a real
// RiderAvatar (with upload affordance) or a fallback stamp without
// this primitive owning the data layer.
// ═══════════════════════════════════════════════════════════

import { type ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { motion } from '@/theme/motion';

export interface RiderIdCardProps {
  /** Avatar element (e.g. <RiderAvatar />). 96×96 expected. */
  avatar: ReactNode;
  /** Rider tag (without the leading '@'; component renders the prefix). */
  riderTag: string;
  /** Rank label, e.g. "CHALLENGER". */
  rankLabel: string;
  /** Numeric level — rendered as "LVL N". */
  level: number;
  /** Optional sub-line: venue-of-record, season-since, etc. */
  meta?: string;
  /** Override the breathing ring color. Defaults to accent. */
  ringColor?: string;
}

export function RiderIdCard({
  avatar,
  riderTag,
  rankLabel,
  level,
  meta,
  ringColor,
}: RiderIdCardProps) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, {
        duration: motion.pulseVerified,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
    return () => {
      cancelAnimation(progress);
    };
  }, [progress]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.4 + progress.value * 0.6,
    transform: [{ scale: 1 + progress.value * 0.04 }],
  }));

  return (
    <View style={styles.root}>
      <View style={styles.avatarWrap}>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            { borderColor: ringColor ?? colors.accent },
            ringStyle,
          ]}
        />
        <View style={styles.avatarSlot}>{avatar}</View>
      </View>

      <Text style={styles.tag} numberOfLines={1} adjustsFontSizeToFit>
        @{riderTag.toUpperCase()}
      </Text>

      <View style={styles.rankRow}>
        <Text style={styles.rankLabel}>{rankLabel.toUpperCase()}</Text>
        <View style={styles.dot} />
        <Text style={styles.rankLevel}>LVL {level}</Text>
      </View>

      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  avatarWrap: {
    width: 112,
    height: 112,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  ring: {
    position: 'absolute',
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1.5,
  },
  avatarSlot: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tag: {
    fontFamily: fonts.racing,
    fontSize: 40,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: 2.64,
    textTransform: 'uppercase',
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textTertiary,
  },
  rankLevel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2.64,
    textTransform: 'uppercase',
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
