// ─────────────────────────────────────────────────────────────
// StreakIndicator — daily-streak summary card
//
// Migrated to canonical: chunk9 → @/theme tokens, 🔥 emoji →
// IconGlyph "rec" (filled accent dot per icons.md "rec" glyph
// which maps semantically to "active/burning streak").
// ─────────────────────────────────────────────────────────────
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { IconGlyph } from '@/components/nwd';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';

type StreakIndicatorProps = {
  days: number;
  mode?: 'safe' | 'warn';
  subtitle: string;
};

export const StreakIndicator = memo(function StreakIndicator({
  days,
  mode = 'safe',
  subtitle,
}: StreakIndicatorProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (mode !== 'warn') {
      opacity.value = 1;
      cancelAnimation(opacity);
      return;
    }

    opacity.value = withRepeat(
      withTiming(0.55, { duration: 2200 }),
      -1,
      true,
    );

    return () => {
      cancelAnimation(opacity);
    };
  }, [mode, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.iconWrap}>
        <IconGlyph name="rec" size={20} variant="default" color={colors.accent} />
      </View>
      <View style={styles.copyBlock}>
        <Text style={styles.title}>{days} dni z rzędu</Text>
        <Text style={[styles.subtitle, mode === 'warn' && styles.subtitleWarn]}>
          {subtitle}
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radii.card,
    padding: spacing.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.lead,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 18,
    lineHeight: 18,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.09,
  },
  subtitle: {
    ...typography.body,
    fontSize: 13,
    color: colors.textSecondary,
  },
  subtitleWarn: {
    color: colors.warn,
  },
});
