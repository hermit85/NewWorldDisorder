import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { formatTime } from '@/content/copy';

interface Props {
  durationMs: number;
  isPb: boolean;
  trailName: string;
}

export function ResultTimeCard({ durationMs, isPb, trailName }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.trailLabel}>{trailName.toUpperCase()}</Text>
      <Text style={[styles.time, isPb && styles.timePb]}>
        {formatTime(durationMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  trailLabel: {
    ...typography.label,
    color: colors.textTertiary,
    letterSpacing: 3,
    marginBottom: spacing.md,
  },
  time: {
    ...typography.timeHero,
    color: colors.textPrimary,
    fontSize: 64,
    letterSpacing: 3,
  },
  timePb: {
    color: colors.accent,
  },
});
