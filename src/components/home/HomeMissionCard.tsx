// ─────────────────────────────────────────────────────────────
// HomeMissionCard — single hero card that adapts to whichever
// mission deriveHomeMission() returns. Replaces TodayChallengeCard
// on Home: it renders on every Home state (no hidden empty path),
// switches kicker tone (green / amber), shows an optional position
// badge and optional KOM block when leaderboard data exists.
//
// Visual zones, top to bottom:
//   1. Header row: kicker (toned) + position badge (right, optional)
//   2. Title row : big H1 trail/mission name + KOM block (right, opt)
//   3. Venue line: small uppercase subtitle (optional)
//   4. Body line : medium gray descriptive line
//   5. Pressure  : smaller secondary line (optional)
//   6. CTA       : full-width primary button (always green)
//
// Trail silhouette in the bg only when KOM block is shown.
// ─────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
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
import type { MissionTone } from '@/features/home/mission';

export interface HomeMissionCardProps {
  kicker: string;
  title: string;
  body: string;
  pressureLine?: string;
  ctaLabel: string;
  tone?: MissionTone;
  positionBadge?: string;
  komTime?: string;
  yourDeltaText?: string;
  venueName?: string;
  onPress: () => void;
}

const TONE_TINTS: Record<MissionTone, { fg: string; dim: string }> = {
  green: { fg: colors.accent, dim: colors.accentDim },
  amber: { fg: colors.gold, dim: colors.goldDim },
  blue: { fg: colors.blue, dim: 'rgba(80, 180, 255, 0.14)' },
};

export function HomeMissionCard({
  kicker,
  title,
  body,
  pressureLine,
  ctaLabel,
  tone = 'green',
  positionBadge,
  komTime,
  yourDeltaText,
  venueName,
  onPress,
}: HomeMissionCardProps) {
  const tints = TONE_TINTS[tone];
  const showSilhouette = !!komTime;

  // Trail silhouette gradient pan — same ambient motion as old hero.
  const pan = useSharedValue(0);
  useEffect(() => {
    if (!showSilhouette) return;
    pan.value = withRepeat(
      withTiming(1, { duration: motion.scanAmbient * 1.2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => { cancelAnimation(pan); };
  }, [pan, showSilhouette]);

  const lineStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pan.value * 0.12,
    transform: [{ translateX: -10 + pan.value * 20 }],
  }));

  return (
    <View style={styles.card}>
      {showSilhouette ? (
        <Animated.View style={[styles.silhouetteWrap, lineStyle]} pointerEvents="none">
          <Svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="missionSilGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={tints.fg} stopOpacity="0" />
                <Stop offset="50%" stopColor={tints.fg} stopOpacity="0.6" />
                <Stop offset="100%" stopColor={tints.fg} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path
              d="M0 60 L32 50 L60 56 L92 38 L120 48 L160 22 L196 36 L228 16 L268 32 L300 18 L320 28"
              stroke="url(#missionSilGrad)"
              strokeWidth="1.5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Animated.View>
      ) : null}

      <View style={styles.kickerRow}>
        <Text style={[styles.kicker, { color: tints.fg }]} numberOfLines={1}>
          {kicker.toUpperCase()}
        </Text>
        {positionBadge ? (
          <View style={[styles.badge, { borderColor: tints.fg, backgroundColor: tints.dim }]}>
            <Text style={[styles.badgeText, { color: tints.fg }]}>{positionBadge}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>
          {venueName ? (
            <Text style={styles.venue} numberOfLines={1}>
              {venueName.toUpperCase()}
            </Text>
          ) : null}
        </View>
        {komTime ? (
          <View style={styles.headerRight}>
            <Text style={styles.komLabel}>KOM</Text>
            <Text style={styles.komTime}>{komTime}</Text>
            {yourDeltaText ? (
              <Text style={styles.delta}>TY {yourDeltaText}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      {body ? (
        <Text style={styles.body} numberOfLines={2}>
          {body}
        </Text>
      ) : null}

      {pressureLine ? (
        <Text style={styles.pressure} numberOfLines={2}>
          {pressureLine}
        </Text>
      ) : null}

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        <Text style={styles.ctaArrow}>→</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
    overflow: 'hidden',
  },
  silhouetteWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 60,
    height: 80,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.racing,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: fonts.racing,
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 30,
    textTransform: 'uppercase',
  },
  venue: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  komLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 2,
  },
  komTime: {
    fontFamily: fonts.racing,
    fontSize: 22,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
  },
  delta: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.6,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  pressure: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 8,
    marginTop: 4,
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  ctaLabel: {
    fontFamily: fonts.racing,
    fontSize: 12,
    fontWeight: '800',
    color: colors.accentInk,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
  },
  ctaArrow: {
    fontFamily: fonts.body,
    fontSize: 18,
    fontWeight: '800',
    color: colors.accentInk,
  },
});
