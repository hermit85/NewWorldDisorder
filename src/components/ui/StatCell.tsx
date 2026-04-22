import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { chunk9Colors, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

type StatCellProps = {
  label: string;
  value: string;
  accent?: boolean;
};

export const StatCell = memo(function StatCell({
  label,
  value,
  accent = false,
}: StatCellProps) {
  return (
    <View style={styles.container}>
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[styles.value, accent && styles.valueAccent]}>
        {value}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: chunk9Spacing.cardChildGap / 3,
  },
  label: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
  },
  value: {
    ...chunk9Typography.stat19,
    color: chunk9Colors.text.primary,
  },
  valueAccent: {
    color: chunk9Colors.accent.emerald,
  },
});
