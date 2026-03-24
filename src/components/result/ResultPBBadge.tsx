import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { copy } from '@/content/copy';

interface Props {
  isPb: boolean;
  improvementMs: number | null;
}

export function ResultPBBadge({ isPb, improvementMs }: Props) {
  if (!isPb) return null;

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.text}>{copy.newPb}</Text>
      </View>
      {improvementMs != null && improvementMs > 0 && (
        <Text style={styles.improvement}>
          -{(improvementMs / 1000).toFixed(1)}s from previous
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  badge: {
    backgroundColor: colors.accentDim,
    borderWidth: 2,
    borderColor: colors.accent,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  text: {
    ...typography.label,
    color: colors.accent,
    fontSize: 18,
    letterSpacing: 4,
  },
  improvement: {
    ...typography.bodySmall,
    color: colors.accent,
    marginTop: spacing.sm,
  },
});
