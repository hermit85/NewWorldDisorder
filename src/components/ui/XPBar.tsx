import { Platform, StyleSheet, Text, View } from 'react-native';
import { memo } from 'react';
import { colors } from '@/theme/colors';
import { spacing, radii } from '@/theme/spacing';

const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

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
    gap: spacing.sm,
  },
  rankLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.86,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    flexShrink: 1,
  },
  levelLabel: {
    fontFamily: monoFont,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  valueText: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 19,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  valueDivider: {
    fontFamily: monoFont,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textTertiary,
  },
  valueTextMuted: {
    fontFamily: monoFont,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  track: {
    height: 4,
    borderRadius: radii.pill,
    overflow: 'hidden',
    backgroundColor: colors.border,
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  tick: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    left: '25%',
    backgroundColor: colors.bg,
    opacity: 0.55,
  },
  tickMid: {
    left: '50%',
  },
  tickEnd: {
    left: '75%',
  },
});
