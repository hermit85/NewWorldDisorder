import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';
import { copy } from '@/content/copy';

interface Props {
  xpGained: number;
}

export function ResultXpMeter({ xpGained }: Props) {
  if (xpGained <= 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.xp}>{copy.xpGained(xpGained)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  xp: {
    ...typography.h3,
    color: colors.gold,
    letterSpacing: 1,
  },
});
