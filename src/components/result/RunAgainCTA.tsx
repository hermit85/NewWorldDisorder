import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { copy } from '@/content/copy';

interface Props {
  onRunAgain: () => void;
  onViewLeaderboard: () => void;
}

export function RunAgainCTA({ onRunAgain, onViewLeaderboard }: Props) {
  return (
    <View style={styles.container}>
      <Pressable style={styles.primaryBtn} onPress={onRunAgain}>
        <Text style={styles.primaryText}>
          {copy.runAgain.toUpperCase()}
        </Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={onViewLeaderboard}>
        <Text style={styles.secondaryText}>
          {copy.viewLeaderboard.toUpperCase()}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  primaryText: {
    ...typography.cta,
    color: colors.bg,
    letterSpacing: 3,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  secondaryText: {
    ...typography.label,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
});
