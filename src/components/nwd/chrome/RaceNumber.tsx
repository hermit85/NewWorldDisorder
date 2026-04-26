// ─────────────────────────────────────────────────────────────
// RaceNumber — big two-digit watermark in the background.
// Display font, weight 900, opacity 0.04 per components.md. Sits
// in a corner with negative offset so the digit half-bleeds off
// the edge — that's the race-game wallpaper feel.
//
// Tabular-nums (so a 1 doesn't push a 7 sideways on rerender)
// + numberOfLines={1} so a render glitch can't word-wrap "07".
// ─────────────────────────────────────────────────────────────
import { StyleSheet, Text, type TextStyle } from 'react-native';
import { colors } from '@/theme/colors';

export interface RaceNumberProps {
  /** Number / token to display. Padded to 2 digits if numeric. */
  n: string | number;
  /** Watermark opacity. Default 0.04. */
  opacity?: number;
  /** Glyph fontSize in px. Default 200. */
  size?: number;
  /** Where to anchor the watermark; negative offset bleeds off-edge. */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  /** Override color (defaults to text-primary). */
  color?: string;
}

function pad(n: string | number): string {
  const s = String(n);
  if (typeof n === 'number' && s.length === 1) return `0${s}`;
  return s;
}

export function RaceNumber({
  n,
  opacity = 0.04,
  size = 200,
  position = 'top-right',
  color,
}: RaceNumberProps) {
  const offset = Math.round(-size * 0.15);
  const positionStyle = (() => {
    switch (position) {
      case 'top-right':    return { top: offset, right: offset };
      case 'top-left':     return { top: offset, left: offset };
      case 'bottom-right': return { bottom: offset, right: offset };
      case 'bottom-left':  return { bottom: offset, left: offset };
    }
  })();
  return (
    <Text
      pointerEvents="none"
      numberOfLines={1}
      style={[
        styles.number,
        positionStyle,
        { fontSize: size, lineHeight: size, opacity, color: color ?? colors.textPrimary },
      ]}
    >
      {pad(n)}
    </Text>
  );
}

const styles = StyleSheet.create({
  number: {
    position: 'absolute',
    fontFamily: 'Rajdhani_700Bold',
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
  },
});
