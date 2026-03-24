// Contextual status banner — shows at top of screens for important state info

import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';

type Variant = 'info' | 'warning' | 'error' | 'success';

interface Props {
  variant: Variant;
  message: string;
  action?: string;
  onPress?: () => void;
}

const variantStyles: Record<Variant, { bg: string; text: string; icon: string }> = {
  info: { bg: 'rgba(0, 122, 255, 0.15)', text: colors.blue, icon: 'ℹ' },
  warning: { bg: 'rgba(255, 149, 0, 0.15)', text: colors.orange, icon: '!' },
  error: { bg: colors.redDim, text: colors.red, icon: '✕' },
  success: { bg: colors.accentDim, text: colors.accent, icon: '✓' },
};

export function StatusBanner({ variant, message, action, onPress }: Props) {
  const v = variantStyles[variant];

  const content = (
    <View style={[styles.container, { backgroundColor: v.bg }]}>
      <Text style={[styles.icon, { color: v.text }]}>{v.icon}</Text>
      <Text style={[styles.message, { color: v.text }]}>{message}</Text>
      {action && <Text style={[styles.action, { color: v.text }]}>{action}</Text>}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }
  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  icon: {
    fontSize: 12,
    fontWeight: '700',
  },
  message: {
    ...typography.bodySmall,
    flex: 1,
  },
  action: {
    ...typography.labelSmall,
    letterSpacing: 1,
  },
});
