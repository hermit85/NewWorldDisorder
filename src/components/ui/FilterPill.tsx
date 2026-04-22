import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { chunk9Colors, chunk9Radii, chunk9Typography } from '@/theme/chunk9';

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
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
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

const styles = StyleSheet.create({
  container: {
    minHeight: 38,
    borderRadius: chunk9Radii.pill,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  containerActive: {
    borderWidth: 1,
    borderColor: chunk9Colors.text.primary,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  containerInactive: {
    borderWidth: 1,
    borderColor: chunk9Colors.bg.hairline,
    backgroundColor: chunk9Colors.bg.surface,
  },
  containerPressed: {
    opacity: 0.86,
  },
  label: {
    ...chunk9Typography.captionMono10,
  },
  labelActive: {
    color: chunk9Colors.text.primary,
  },
  labelInactive: {
    color: chunk9Colors.text.secondary,
  },
  countBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: chunk9Radii.pill,
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
    ...chunk9Typography.captionMono10,
    lineHeight: 10,
  },
  countTextActive: {
    color: chunk9Colors.text.primary,
  },
  countTextInactive: {
    color: chunk9Colors.text.secondary,
  },
});
