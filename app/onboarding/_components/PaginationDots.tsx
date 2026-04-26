// ═══════════════════════════════════════════════════════════
// PaginationDots — active dot expands 6→20px on slide change.
//
// Animation 200ms out(cubic). Inactive dots stay at 6×3.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/theme/colors';

export interface PaginationDotsProps {
  count: number;
  activeIndex: number;
}

const DOT_HEIGHT = 3;
const DOT_INACTIVE = 6;
const DOT_ACTIVE = 20;
const DOT_GAP = 6;

export const PaginationDots = memo(function PaginationDots({
  count,
  activeIndex,
}: PaginationDotsProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} active={i === activeIndex} />
      ))}
    </View>
  );
});

function Dot({ active }: { active: boolean }) {
  const target = useDerivedValue(() =>
    withTiming(active ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) }),
  );

  const style = useAnimatedStyle(() => ({
    width: DOT_INACTIVE + (DOT_ACTIVE - DOT_INACTIVE) * target.value,
    backgroundColor: active ? colors.accent : 'rgba(255,255,255,0.45)',
  }));

  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: DOT_GAP,
  },
  dot: {
    height: DOT_HEIGHT,
    borderRadius: DOT_HEIGHT / 2,
  },
});
