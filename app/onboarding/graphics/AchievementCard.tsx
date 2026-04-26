// ═══════════════════════════════════════════════════════════
// AchievementCard — slide 03 achievement tile.
//
// Three tier variants: bronze | gold | locked. Each tier owns
// its own border/background tint, badge tint, and inline SVG
// icon (filled drop / star / lock — these are one-off marketing
// graphics, not the canonical IconGlyph stroke set, hence inline).
//
// Locked variant carries a numeric progress label `12 / 50`
// instead of the tier badge so the user sees how far they are.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Polygon, Rect } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export type AchievementTier = 'bronze' | 'gold' | 'locked';

export interface AchievementCardProps {
  tier: AchievementTier;
  name: string;
  /** Locked tier: numeric progress like '12 / 50'. */
  progress?: string;
}

const TIER_TINT: Record<AchievementTier, string> = {
  bronze: 'rgba(224, 138, 92, 0.06)',
  gold: 'rgba(255, 210, 63, 0.10)',
  locked: 'rgba(201, 209, 214, 0.04)',
};

const TIER_BORDER: Record<AchievementTier, string> = {
  bronze: 'rgba(224, 138, 92, 0.5)',
  gold: 'rgba(255, 210, 63, 0.5)',
  locked: 'rgba(201, 209, 214, 0.25)',
};

const TIER_ACCENT: Record<AchievementTier, string> = {
  bronze: colors.bronze,
  gold: colors.gold,
  locked: colors.silver,
};

const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: '● BRĄZ',
  gold: '● ZŁOTO',
  locked: '',
};

export const AchievementCard = memo(function AchievementCard({
  tier,
  name,
  progress,
}: AchievementCardProps) {
  const accent = TIER_ACCENT[tier];

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: TIER_TINT[tier],
          borderColor: TIER_BORDER[tier],
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          {
            backgroundColor: TIER_TINT[tier],
            borderColor: accent,
            borderStyle: tier === 'locked' ? 'dashed' : 'solid',
          },
        ]}
      >
        <TierIcon tier={tier} accent={accent} />
      </View>

      <Text
        style={[styles.name, tier === 'locked' && styles.nameMuted]}
        numberOfLines={1}
      >
        {name}
      </Text>

      {tier === 'locked' && progress ? (
        <Text style={[styles.progress, { color: accent }]}>{progress}</Text>
      ) : (
        <Text style={[styles.tierLabel, { color: accent }]}>{TIER_LABEL[tier]}</Text>
      )}
    </View>
  );
});

function TierIcon({ tier, accent }: { tier: AchievementTier; accent: string }) {
  if (tier === 'bronze') {
    // Blood drop (filled). Spec path with dimensions normalised
    // to 24×24 viewBox.
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Path
          d="M 12 3 L 17 11 A 6 6 0 1 1 7 11 Z"
          fill={accent}
          stroke={accent}
          strokeWidth={1.2}
        />
      </Svg>
    );
  }

  if (tier === 'gold') {
    // 5-point star, filled.
    return (
      <Svg width={18} height={18} viewBox="0 0 24 24">
        <Polygon
          points="12,2 14.9,8.9 22.4,9.6 16.7,14.5 18.4,21.8 12,17.8 5.6,21.8 7.3,14.5 1.6,9.6 9.1,8.9"
          fill={accent}
          stroke={accent}
          strokeWidth={1}
          strokeLinejoin="round"
        />
      </Svg>
    );
  }

  // locked — padlock body + bow
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        d="M 8 11 V 8 a 4 4 0 0 1 8 0 v 3"
        fill="none"
        stroke={accent}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Rect
        x={6}
        y={11}
        width={12}
        height={9}
        rx={1.5}
        fill="none"
        stroke={accent}
        strokeWidth={1.6}
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 98,
    height: 80,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    alignItems: 'center',
    gap: 4,
  },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 9,
    lineHeight: 11,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  nameMuted: {
    color: colors.textTertiary,
  },
  tierLabel: {
    fontFamily: fonts.mono,
    fontSize: 7,
    lineHeight: 9,
    letterSpacing: 1.2,
  },
  progress: {
    fontFamily: fonts.racing,
    fontSize: 10,
    lineHeight: 12,
  },
});
