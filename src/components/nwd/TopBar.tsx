// ─────────────────────────────────────────────────────────────
// TopBar — back button + optional title + optional trailing slot
//
// Per ui.jsx TopBar. Sits at the top of detail screens (Spot,
// Trail, Run, Settings). 38×38 round back button with hairline
// border, mono CAPS title, free trailing slot for season pill etc.
// ─────────────────────────────────────────────────────────────
import { ReactNode, useCallback } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { IconGlyph } from './IconGlyph';

export interface TopBarProps {
  onBack?: () => void;
  title?: string | null;
  trailing?: ReactNode;
  style?: ViewStyle;
}

export function TopBar({ onBack, title, trailing, style }: TopBarProps) {
  const handleBack = useCallback(() => {
    if (!onBack) return;
    Haptics.selectionAsync().catch(() => undefined);
    onBack();
  }, [onBack]);

  return (
    <View style={[styles.container, style]}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wróć"
          onPress={handleBack}
          style={({ pressed }) => [styles.back, pressed && { opacity: 0.7 }]}
          hitSlop={12}
        >
          <IconGlyph name="arrow-left" size={18} color={colors.textPrimary} />
        </Pressable>
      ) : null}

      {title ? (
        <Text style={styles.title} numberOfLines={1}>
          {title.toUpperCase()}
        </Text>
      ) : (
        <View style={styles.spacer} />
      )}

      {trailing ?? null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 4,
    paddingBottom: 12,
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  spacer: {
    flex: 1,
  },
  title: {
    ...typography.label,
    flex: 1,
    color: colors.textSecondary,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 1.98, // 0.18em @ 11
  },
});
