import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { Achievement } from '@/data/types';
import { copy } from '@/content/copy';

interface Props {
  achievement: Achievement | null;
}

export function ResultAchievementUnlock({ achievement }: Props) {
  if (!achievement) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {copy.achievementUnlocked.toUpperCase()}
      </Text>
      <View style={styles.badge}>
        <Text style={styles.icon}>{achievement.icon}</Text>
        <Text style={styles.name}>{achievement.name}</Text>
        <Text style={styles.desc}>{achievement.description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.labelSmall,
    color: colors.gold,
    letterSpacing: 3,
    marginBottom: spacing.sm,
  },
  badge: {
    backgroundColor: colors.goldDim,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  icon: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  name: {
    ...typography.h3,
    color: colors.gold,
  },
  desc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xxs,
  },
});
