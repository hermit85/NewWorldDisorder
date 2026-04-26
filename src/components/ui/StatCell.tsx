import { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';

const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

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
    gap: 4,
  },
  label: {
    fontFamily: monoFont,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  value: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 19,
    lineHeight: 24,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  valueAccent: {
    color: colors.accent,
  },
});
