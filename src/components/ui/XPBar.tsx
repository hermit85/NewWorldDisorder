import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type XPBarProps = {
  current: number;
  max: number;
  rank: string;
  level: number;
  compact?: boolean;
};

export const XPBar = memo(function XPBar({
  current,
  max,
  rank,
  level,
  compact = false,
}: XPBarProps) {
  const safeMax = Math.max(max, 1);
  const progress = Math.max(0, Math.min(1, current / safeMax));

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.topRow}>
        <Text style={styles.rankLabel} numberOfLines={1}>
          {rank}
        </Text>
        <Text style={styles.levelLabel} numberOfLines={1}>
          Lvl {level}
        </Text>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.valueText}>{current}</Text>
        <Text style={styles.valueDivider}>/</Text>
        <Text style={styles.valueTextMuted}>{max}</Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
        <View style={styles.tick} />
        <View style={[styles.tick, styles.tickMid]} />
        <View style={[styles.tick, styles.tickEnd]} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    minWidth: 126,
    gap: 8,
  },
  containerCompact: {
    minWidth: 112,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: chunk9Spacing.cardChildGap,
  },
  rankLabel: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
    flexShrink: 1,
  },
  levelLabel: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  valueText: {
    ...chunk9Typography.stat19,
    color: chunk9Colors.text.primary,
  },
  valueDivider: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.tertiary,
  },
  valueTextMuted: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
  },
  track: {
    height: 4,
    borderRadius: chunk9Radii.pill,
    overflow: 'hidden',
    backgroundColor: chunk9Colors.bg.hairline,
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: chunk9Radii.pill,
    backgroundColor: chunk9Colors.accent.emerald,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    left: '25%',
    backgroundColor: chunk9Colors.bg.base,
    opacity: 0.55,
  },
  tickMid: {
    left: '50%',
  },
  tickEnd: {
    left: '75%',
  },
});
