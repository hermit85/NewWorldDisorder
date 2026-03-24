import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { copy } from '@/content/copy';

interface Props {
  position: number;
  delta: number;
}

export function ResultRankDelta({ position, delta }: Props) {
  const deltaColor =
    delta > 0 ? colors.accent : delta < 0 ? colors.red : colors.textTertiary;
  const deltaText =
    delta > 0
      ? copy.movedUp(delta)
      : delta < 0
        ? copy.movedDown(Math.abs(delta))
        : copy.holdingPosition;

  return (
    <View style={styles.container}>
      <View style={styles.positionBox}>
        <Text style={styles.hash}>#</Text>
        <Text style={styles.position}>{position}</Text>
      </View>
      <View style={[styles.deltaBadge, { backgroundColor: deltaColor + '20' }]}>
        {delta > 0 && <Text style={[styles.arrow, { color: deltaColor }]}>↑</Text>}
        {delta < 0 && <Text style={[styles.arrow, { color: deltaColor }]}>↓</Text>}
        <Text style={[styles.deltaText, { color: deltaColor }]}>
          {deltaText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  positionBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  hash: {
    ...typography.positionLarge,
    color: colors.textTertiary,
    fontSize: 20,
  },
  position: {
    ...typography.positionLarge,
    color: colors.textPrimary,
  },
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xxs,
  },
  arrow: {
    fontSize: 16,
    fontWeight: '700',
  },
  deltaText: {
    ...typography.bodySmall,
    fontFamily: 'Inter_600SemiBold',
  },
});
