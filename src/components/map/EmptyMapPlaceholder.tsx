// ═══════════════════════════════════════════════════════════
// EmptyMapPlaceholder — rendered in place of ArenaMap when the
// currently-viewed spot has no trail geometry yet (pre-Sprint-3
// calibration). Keeps the dark-terrain aesthetic of the map so the
// screen does not collapse into a grey "no data" void.
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing } from '@/theme/spacing';

const GRID_SPACING = 20;
const ROWS = 60;

export function EmptyMapPlaceholder() {
  return (
    <View style={styles.root}>
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: ROWS }).map((_, i) => (
          <View
            key={i}
            style={[styles.gridLine, { top: i * GRID_SPACING }]}
          />
        ))}
      </View>
      <Text style={styles.label}>
        Mapa trasy pojawi się po pierwszym zjeździe Pioniera
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 240,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    overflow: 'hidden',
  },
  grid: {
    ...StyleSheet.absoluteFillObject,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    ...typography.body,
    color: colors.accent,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
