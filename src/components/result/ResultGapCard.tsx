import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';

interface Props {
  gapMs: number;
  targetPosition: number;
  targetUsername: string;
}

export function ResultGapCard({ gapMs, targetPosition, targetUsername }: Props) {
  const gapSeconds = (gapMs / 1000).toFixed(1);

  return (
    <View style={styles.container}>
      <Text style={styles.gapTime}>{gapSeconds}s</Text>
      <Text style={styles.gapLabel}>
        to #{targetPosition} {targetUsername}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gapTime: {
    ...typography.timeMedium,
    color: colors.orange,
  },
  gapLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
});
