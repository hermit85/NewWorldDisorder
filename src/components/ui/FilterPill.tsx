import { memo, useCallback } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/spacing';

const monoFont = Platform.select({
  ios: 'Menlo',
  android: 'monospace',
  default: 'monospace',
});

type FilterPillProps = {
  label: string;
  active?: boolean;
  count?: number;
  onPress?: () => void;
};

export const FilterPill = memo(function FilterPill({
  label,
  active = false,
  count,
  onPress,
}: FilterPillProps) {
  const handlePress = useCallback(() => {
    // Spec v2 1.5: pill toggle fires haptic.tap
    Haptics.selectionAsync().catch(() => undefined);
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={typeof count === 'number' ? `Filtr ${label}, ${count}` : `Filtr ${label}`}
      accessibilityState={{ selected: active }}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        active ? styles.containerActive : styles.containerInactive,
        pressed && styles.containerPressed,
      ]}
    >
      <Text style={[styles.label, active ? styles.labelActive : styles.labelInactive]}>
        {label}
      </Text>
      {typeof count === 'number' && (
        <View style={[styles.countBadge, active ? styles.countBadgeActive : styles.countBadgeInactive]}>
          <Text style={[styles.countText, active ? styles.countTextActive : styles.countTextInactive]}>
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
});

const captionMono10 = {
  fontFamily: monoFont,
  fontSize: 10,
  lineHeight: 14,
  letterSpacing: 1.4,
  textTransform: 'uppercase' as const,
};

const styles = StyleSheet.create({
  container: {
    minHeight: 38,
    borderRadius: radii.pill,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  containerActive: {
    borderWidth: 1,
    borderColor: colors.textPrimary,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  containerInactive: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  containerPressed: {
    opacity: 0.86,
  },
  label: captionMono10,
  labelActive: {
    color: colors.textPrimary,
  },
  labelInactive: {
    color: colors.textSecondary,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  countBadgeInactive: {
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  countText: {
    ...captionMono10,
    lineHeight: 10,
  },
  countTextActive: {
    color: colors.textPrimary,
  },
  countTextInactive: {
    color: colors.textSecondary,
  },
});
