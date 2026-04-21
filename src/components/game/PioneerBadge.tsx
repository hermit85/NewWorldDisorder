// ═══════════════════════════════════════════════════════════
// PioneerBadge — Ye brutalist (ADR-013).
//
// Emerald circle patch with lightning bolt. Replaced the Sprint-4 SVG
// Path approach — a patch-style circle reads more jersey/embroidery
// and less "game UI" alongside the serif direction.
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet } from 'react-native';
import { hudColors, hudType } from '@/theme/gameHud';

export interface PioneerBadgeProps {
  size?: 'sm' | 'md';
  /** If true, renders 'PIONEER' text next to the circle. */
  label?: boolean;
}

export function PioneerBadge({ size = 'md', label = false }: PioneerBadgeProps) {
  const dim = size === 'sm' ? 14 : 18;
  const glyph = size === 'sm' ? 8 : 10;
  return (
    <View style={styles.row} accessibilityLabel="Pioneer tej trasy">
      <View
        style={[
          styles.dot,
          { width: dim, height: dim, borderRadius: dim / 2 },
        ]}
      >
        <Text style={[styles.glyph, { fontSize: glyph }]}>⚡</Text>
      </View>
      {label && <Text style={styles.label}>PIONEER</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: {
    backgroundColor: hudColors.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    color: hudColors.text.inverse,
    fontWeight: '700',
    // Optical centering: the ⚡ glyph sits slightly low at small sizes.
    marginTop: -1,
  },
  label: {
    ...hudType.label,
    color: hudColors.signal,
  },
});
