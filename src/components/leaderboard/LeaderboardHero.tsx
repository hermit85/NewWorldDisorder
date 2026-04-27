// ─────────────────────────────────────────────────────────────
// LeaderboardHero — Tablica's primary card.
//
// Mirrors HomeMissionCard's visual grammar (kicker / title / body
// / pressure / CTA) but the title slot is the rider's POSITION
// (e.g. "JESTEŚ #2"), the right column is the LEADER's time + gap,
// and the position badge in the corner is large enough to read
// "ouch, jestem drugi" at a glance.
// ─────────────────────────────────────────────────────────────

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import type { MissionTone } from '@/features/home/mission';

export interface LeaderboardHeroProps {
  kicker: string;
  title: string;
  body: string;
  pressureLine?: string;
  tone?: MissionTone;
  positionBadge?: string;
  leaderTime?: string;
  gapText?: string;
  ctaLabel?: string;
  onPress?: () => void;
}

const TONE_TINTS: Record<MissionTone, { fg: string; dim: string }> = {
  green: { fg: colors.accent, dim: colors.accentDim },
  amber: { fg: colors.gold, dim: colors.goldDim },
  blue: { fg: colors.blue, dim: 'rgba(80, 180, 255, 0.14)' },
};

export function LeaderboardHero({
  kicker,
  title,
  body,
  pressureLine,
  tone = 'amber',
  positionBadge,
  leaderTime,
  gapText,
  ctaLabel,
  onPress,
}: LeaderboardHeroProps) {
  const tints = TONE_TINTS[tone];

  return (
    <View style={styles.card}>
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

      <View style={styles.titleRow}>
        <View style={styles.titleLeft}>
          <Text style={styles.title} numberOfLines={2}>
            {title.toUpperCase()}
          </Text>
        </View>
        {leaderTime ? (
          <View style={styles.titleRight}>
            <Text style={styles.leaderLabel}>LIDER</Text>
            <Text style={styles.leaderTime}>{leaderTime}</Text>
            {gapText ? (
              <Text style={styles.gapText}>TY {gapText}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <Text style={styles.body} numberOfLines={2}>
        {body}
      </Text>

      {pressureLine ? (
        <Text style={styles.pressure} numberOfLines={2}>
          {pressureLine}
        </Text>
      ) : null}

      {ctaLabel && onPress ? (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
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
    gap: 14,
    overflow: 'hidden',
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
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeText: {
    fontFamily: fonts.racing,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  titleLeft: {
    flex: 1,
  },
  title: {
    fontFamily: fonts.racing,
    fontSize: 32,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    lineHeight: 34,
    textTransform: 'uppercase',
  },
  titleRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  leaderLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 2,
  },
  leaderTime: {
    fontFamily: fonts.racing,
    fontSize: 22,
    fontWeight: '700',
    color: colors.gold,
    letterSpacing: 0.5,
  },
  gapText: {
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
    height: 48,
    borderRadius: 24,
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
