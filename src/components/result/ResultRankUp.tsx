import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { RankId } from '@/data/types';
import { getRank } from '@/systems/ranks';
import { copy } from '@/content/copy';

interface Props {
  from: RankId;
  to: RankId;
}

export function ResultRankUp({ from, to }: Props) {
  const fromRank = getRank(from);
  const toRank = getRank(to);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>RANK UP</Text>
      <View style={styles.rankFlow}>
        <Text style={[styles.rankOld, { color: fromRank.color }]}>
          {fromRank.icon} {fromRank.name}
        </Text>
        <Text style={styles.arrow}>→</Text>
        <Text style={[styles.rankNew, { color: toRank.color }]}>
          {toRank.icon} {toRank.name}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    color: colors.gold,
    letterSpacing: 4,
    marginBottom: spacing.md,
  },
  rankFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rankOld: {
    ...typography.h3,
    opacity: 0.6,
  },
  arrow: {
    ...typography.h2,
    color: colors.gold,
  },
  rankNew: {
    ...typography.h2,
  },
});
