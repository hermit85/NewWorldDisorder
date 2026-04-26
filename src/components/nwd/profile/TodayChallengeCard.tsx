// ═══════════════════════════════════════════════════════════
// TodayChallengeCard — "DZIŚ DO BICIA" hero card on Home.
//
// Picks a featured trail for the rider (recommendation logic
// owned by the consumer; this primitive is layout). Big trail
// name in Rajdhani, KOM time + your delta on the right, animated
// trail silhouette in the background, primary CTA at the bottom.
// ═══════════════════════════════════════════════════════════

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

export interface TodayChallengeCardProps {
  /** Trail name displayed as the headline. */
  trailName: string;
  /** Bike park / venue context. */
  venueName: string;
  /** KOM time in formatted string ("1:21.0"). */
  komTime: string;
  /** Optional rider's PB time on this trail. */
  yourTime?: string | null;
  /** Optional rider's delta to KOM ("+3.2s"). Auto-prefixed with sign. */
  yourDeltaText?: string | null;
  /** Tap → start ranked attempt. */
  onPress?: () => void;
  /** CTA text. Default "JEDŹ RANKINGOWO". */
  ctaLabel?: string;
}

export function TodayChallengeCard({
  trailName,
  venueName,
  komTime,
  yourTime,
  yourDeltaText,
  onPress,
  ctaLabel = 'JEDŹ RANKINGOWO',
}: TodayChallengeCardProps) {
  // Trail silhouette gradient pan — slow, subtle, ambient.
  const pan = useSharedValue(0);
  useEffect(() => {
    pan.value = withRepeat(
      withTiming(1, { duration: motion.scanAmbient * 1.2, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => { cancelAnimation(pan); };
  }, [pan]);

  const lineStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + pan.value * 0.12,
    transform: [{ translateX: -10 + pan.value * 20 }],
  }));

  return (
    <View style={styles.card}>
      {/* Trail silhouette — abstract elevation profile in the bg */}
      <Animated.View style={[styles.silhouetteWrap, lineStyle]} pointerEvents="none">
        <Svg width="100%" height="80" viewBox="0 0 320 80" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="silGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={colors.accent} stopOpacity="0" />
              <Stop offset="50%" stopColor={colors.accent} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={colors.accent} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path
            d="M0 60 L32 50 L60 56 L92 38 L120 48 L160 22 L196 36 L228 16 L268 32 L300 18 L320 28"
            stroke="url(#silGrad)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      <Text style={styles.kicker}>DZIŚ DO BICIA</Text>

      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.trailName} numberOfLines={2}>
            {trailName.toUpperCase()}
          </Text>
          <Text style={styles.venue} numberOfLines={1}>
            {venueName.toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.komLabel}>KOM</Text>
          <Text style={styles.komTime}>{komTime}</Text>
          {yourDeltaText ? (
            <Text style={styles.delta}>TY {yourDeltaText}</Text>
          ) : yourTime ? (
            <Text style={styles.delta}>TY {yourTime}</Text>
          ) : (
            <Text style={styles.deltaEmpty}>BRAK PB</Text>
          )}
        </View>
      </View>

      {onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </Pressable>
      ) : null}
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
    gap: 16,
    overflow: 'hidden',
  },
  silhouetteWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 60,
    height: 80,
  },
  kicker: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
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
  trailName: {
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
  deltaEmpty: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 1.6,
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
  },
  ctaPressed: {
    transform: [{ scale: 0.98 }],
  },
  ctaLabel: {
    fontFamily: 'Rajdhani_700Bold',
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
