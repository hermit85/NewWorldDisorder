import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { copy } from '@/content/copy';

interface Props {
  challengeName: string;
  current: number;
  target: number;
  justCompleted: boolean;
}

export function ResultChallengeProgress({
  challengeName,
  current,
  target,
  justCompleted,
}: Props) {
  const progress = Math.min(current / target, 1);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{challengeName}</Text>
        <Text
          style={[styles.count, justCompleted && { color: colors.accent }]}
        >
          {justCompleted
            ? copy.challengeComplete.toUpperCase()
            : copy.challengeProgress(current, target)}
        </Text>
      </View>
      <View style={styles.barBg}>
        <View
          style={[
            styles.barFill,
            {
              width: `${progress * 100}%`,
              backgroundColor: justCompleted ? colors.accent : colors.blue,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bgCard,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  count: {
    ...typography.label,
    color: colors.textSecondary,
  },
  barBg: {
    height: 4,
    backgroundColor: colors.bgElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});
