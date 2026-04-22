import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { chunk9Colors, chunk9Radii, chunk9Spacing, chunk9Typography } from '@/theme/chunk9';

export type ChallengeItemData = {
  id: string;
  title: string;
  subtitle: string;
  xpLabel: string;
};

export type ChallengeItemProgress = {
  completed: boolean;
};

type ChallengeItemProps = {
  challenge: ChallengeItemData;
  progress: ChallengeItemProgress;
  onPress?: () => void;
};

export const ChallengeItem = memo(function ChallengeItem({
  challenge,
  progress,
  onPress,
}: ChallengeItemProps) {
  const handlePress = useCallback(() => {
    // Spec v2 1.5: tap on challenge row fires haptic.tap
    Haptics.selectionAsync().catch(() => undefined);
    onPress?.();
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handlePress}
      style={({ pressed }) => [styles.container, pressed && styles.containerPressed]}
    >
      <View style={[styles.checkbox, progress.completed && styles.checkboxCompleted]}>
        {progress.completed && <View style={styles.checkboxInner} />}
      </View>

      <View style={styles.copyBlock}>
        <Text style={styles.title}>{challenge.title}</Text>
        <Text style={styles.subtitle}>{challenge.subtitle}</Text>
      </View>

      <Text style={styles.xpLabel}>{challenge.xpLabel}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: chunk9Radii.card,
    paddingVertical: 12,
  },
  containerPressed: {
    opacity: 0.88,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: chunk9Colors.bg.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: chunk9Colors.bg.surface,
  },
  checkboxCompleted: {
    borderColor: chunk9Colors.accent.emerald,
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: chunk9Colors.accent.emerald,
  },
  copyBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...chunk9Typography.body13,
    color: chunk9Colors.text.primary,
  },
  subtitle: {
    ...chunk9Typography.captionMono10,
    color: chunk9Colors.text.secondary,
  },
  xpLabel: {
    ...chunk9Typography.label13,
    color: chunk9Colors.text.primary,
    textAlign: 'right',
    marginLeft: chunk9Spacing.cardChildGap,
  },
});
