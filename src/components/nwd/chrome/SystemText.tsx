// ─────────────────────────────────────────────────────────────
// SystemText — tiny mono caption pinned to a screen corner. Used
// for "STATUS · SLOT 03/07", "BIKE PARK", "4G", etc. — system-HUD
// tags that sit outside the main content flow.
//
// 9px micro size, 0.32em tracking (≈2.88 absolute @ 9px), upper
// case, mono font. Default color textTertiary so it stays in the
// chrome layer, not the content layer.
// ─────────────────────────────────────────────────────────────
import { StyleSheet, Text } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export type SystemTextSlot = 'tl' | 'tr' | 'bl' | 'br';

export interface SystemTextProps {
  slot: SystemTextSlot;
  children: string;
  /** Distance from each edge in px. Default 12. */
  inset?: number;
  /** Override color. */
  color?: string;
}

export function SystemText({ slot, children, inset = 12, color }: SystemTextProps) {
  const positionStyle = (() => {
    switch (slot) {
      case 'tl': return { top: inset, left: inset };
      case 'tr': return { top: inset, right: inset };
      case 'bl': return { bottom: inset, left: inset };
      case 'br': return { bottom: inset, right: inset };
    }
  })();
  return (
    <Text
      pointerEvents="none"
      numberOfLines={1}
      style={[
        styles.text,
        positionStyle,
        color ? { color } : null,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    position: 'absolute',
    fontFamily: fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    color: colors.textTertiary,
    letterSpacing: 2.88,
    textTransform: 'uppercase',
  },
});
