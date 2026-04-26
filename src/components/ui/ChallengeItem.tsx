import { memo, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';

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
    borderRadius: radii.card,
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
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.panel,
  },
  checkboxCompleted: {
    borderColor: colors.accent,
  },
  checkboxInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  copyBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.body,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 19.5,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.micro,
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: colors.textSecondary,
  },
  xpLabel: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 2.86,
    textTransform: 'uppercase',
    color: colors.textPrimary,
    textAlign: 'right',
    marginLeft: spacing.sm,
  },
});
