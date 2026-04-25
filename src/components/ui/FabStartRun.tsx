// ─────────────────────────────────────────────────────────────
// FabStartRun — bottom-right floating action group
//
// design-system/Bike Park Hub.html .fabZone:
//   [○ locate]
//   [START RUN]   ← small caps label
//   [▶ accent FAB] ← 60×60, accent fill, glowHot shadow
//
// Locate button is optional (passed via onLocate). The primary
// FAB is the START RUN trigger and gets the accent glow.
// ─────────────────────────────────────────────────────────────
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Polygon, Circle, Line as SvgLine } from 'react-native-svg';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export interface FabStartRunProps {
  onStart: () => void;
  onLocate?: () => void;
  /** When false, START RUN sits disabled — used when ride mode is unavailable. */
  enabled?: boolean;
  style?: ViewStyle;
}

export function FabStartRun({
  onStart,
  onLocate,
  enabled = true,
  style,
}: FabStartRunProps) {
  const handleStart = () => {
    if (!enabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => undefined);
    onStart();
  };

  const handleLocate = () => {
    Haptics.selectionAsync().catch(() => undefined);
    onLocate?.();
  };

  return (
    <View style={[styles.zone, style]}>
      {onLocate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Wycentruj na mojej pozycji"
          onPress={handleLocate}
          style={({ pressed }) => [styles.locate, pressed && { opacity: 0.85 }]}
        >
          <Svg width={18} height={18} viewBox="0 0 18 18" fill="none">
            <Circle cx="9" cy="9" r="2.5" stroke={colors.textPrimary} strokeWidth="1.6" />
            <Circle cx="9" cy="9" r="6.5" stroke={colors.textPrimary} strokeWidth="1.6" />
            <SvgLine x1="9" y1="0.5" x2="9" y2="3" stroke={colors.textPrimary} strokeWidth="1.6" />
            <SvgLine x1="9" y1="15" x2="9" y2="17.5" stroke={colors.textPrimary} strokeWidth="1.6" />
            <SvgLine x1="0.5" y1="9" x2="3" y2="9" stroke={colors.textPrimary} strokeWidth="1.6" />
            <SvgLine x1="15" y1="9" x2="17.5" y2="9" stroke={colors.textPrimary} strokeWidth="1.6" />
          </Svg>
        </Pressable>
      ) : null}

      <Text style={styles.label}>START RUN</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Rozpocznij przejazd"
        onPress={handleStart}
        disabled={!enabled}
        style={({ pressed }) => [
          styles.fab,
          !enabled && styles.fabDisabled,
          pressed && enabled && { transform: [{ scale: 0.96 }] },
        ]}
      >
        <Svg width={22} height={22} viewBox="0 0 22 22" fill="none">
          <Polygon
            points="6,4 18,11 6,18"
            fill={colors.accentInk}
            stroke="none"
          />
        </Svg>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    gap: 8,
    alignItems: 'flex-end',
  },
  locate: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(7, 9, 10, 0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.micro,
    fontSize: 8,
    letterSpacing: 1.92, // 0.24em @ 8px
    fontWeight: '800',
    color: colors.textPrimary,
    backgroundColor: 'rgba(7, 9, 10, 0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  fabDisabled: {
    opacity: 0.4,
  },
});
