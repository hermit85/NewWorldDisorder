// ═══════════════════════════════════════════════════════════
// RankBadge — gradient pill used in slide 03 rank card.
//
// 44×44 round, accent → accentDeep linear gradient, dark numeral
// centered (Rajdhani 22). Re-usable in (tabs)/profile.tsx if/when
// the ranks card adopts the v8 visual.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export interface RankBadgeProps {
  level: number;
  size?: number;
}

export const RankBadge = memo(function RankBadge({
  level,
  size = 44,
}: RankBadgeProps) {
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Defs>
          <LinearGradient id="rankBadgeFill" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={colors.accent} />
            <Stop offset="100%" stopColor={colors.accentDeep} />
          </LinearGradient>
        </Defs>
        <Rect width={size} height={size} rx={size / 2} ry={size / 2} fill="url(#rankBadgeFill)" />
      </Svg>
      <Text style={styles.numeral}>{level}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  numeral: {
    fontFamily: fonts.racing,
    fontSize: 22,
    lineHeight: 22,
    color: colors.accentInk,
  },
});
