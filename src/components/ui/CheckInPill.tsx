// ─────────────────────────────────────────────────────────────
// CheckInPill — top floating "JESTEŚ W PARKU" hud chip
//
// design-system/Bike Park Hub.html .checkin component:
//   [● accent dot pulsing] LABEL  RIGHT-ALIGNED SUB
//
// Two variants:
//   "armed"   — accent dot pulsing, accent border + glow,
//               accent label (e.g. "JESTEŚ W PARKU")
//   "browse"  — muted dot static, hairline border, muted label
//               (e.g. "BROWSING SŁOTWINY")
//
// Renders as a self-contained pill the parent positions absolutely.
// We don't ship expo-blur yet, so the design's `backdrop-filter:
// blur(12px)` falls back to a solid rgba(7,9,10,0.85) the design
// itself uses as the pre-blur background.
// ─────────────────────────────────────────────────────────────
import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';

export interface CheckInPillProps {
  variant?: 'armed' | 'browse';
  label: string;
  /** Right-aligned subtitle, e.g. "12 MIN TEMU" / "JESTEŚ TU". */
  sub?: string | null;
  style?: ViewStyle;
}

export function CheckInPill({
  variant = 'armed',
  label,
  sub,
  style,
}: CheckInPillProps) {
  const ringScale = useRef(new Animated.Value(0)).current;
  const armed = variant === 'armed';

  useEffect(() => {
    if (!armed) return;
    const loop = Animated.loop(
      Animated.timing(ringScale, {
        toValue: 1,
        duration: 1600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
  }, [armed, ringScale]);

  const ringScaleInterp = ringScale.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 3.4],
  });
  const ringOpacity = ringScale.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  return (
    <View
      style={[
        styles.pill,
        armed ? styles.pillArmed : styles.pillBrowse,
        style,
      ]}
    >
      <View style={styles.dotWrap}>
        {armed && (
          <Animated.View
            style={[
              styles.dotRing,
              {
                transform: [{ scale: ringScaleInterp }],
                opacity: ringOpacity,
              },
            ]}
          />
        )}
        <View
          style={[
            styles.dot,
            { backgroundColor: armed ? colors.accent : colors.textSecondary },
          ]}
        />
      </View>

      <Text
        style={[
          styles.label,
          armed ? { color: colors.accent } : { color: colors.textSecondary },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {sub ? (
        <Text style={styles.sub} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(7, 9, 10, 0.85)',
  },
  pillArmed: {
    borderColor: colors.borderHot,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.30,
    shadowRadius: 16,
    elevation: 6,
  },
  pillBrowse: {
    borderColor: colors.border,
  },
  dotWrap: {
    width: 7,
    height: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotRing: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(0, 255, 135, 0.5)',
  },
  label: {
    ...typography.micro,
    fontSize: 10,
    letterSpacing: 2.4, // 0.24em @ 10px
    fontWeight: '800',
    flex: 0,
  },
  sub: {
    ...typography.body,
    fontSize: 11,
    color: colors.textPrimary,
    fontWeight: '600',
    marginLeft: 'auto',
  },
});
