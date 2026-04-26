// ─────────────────────────────────────────────────────────────
// ScanLines — repeating-line CRT overlay. Sits on top of the
// content with pointer-events disabled so taps still hit the
// underlying tree.
//
// CSS canonical (web): repeating-linear-gradient(0deg,
//   var(--nwd-text) 0 0.5px, transparent 0.5px 3px). RN port
// uses an SVG <Pattern> fill — same effect, GPU-accelerated.
// ─────────────────────────────────────────────────────────────
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect, Line } from 'react-native-svg';
import { colors } from '@/theme/colors';

export interface ScanLinesProps {
  /** Overall overlay opacity. Default 0.05 — barely-there CRT haze. */
  opacity?: number;
  /** Line color. Defaults to text-primary. */
  color?: string;
  /** Vertical spacing between lines in px. Default 3. */
  spacing?: number;
}

export function ScanLines({
  opacity = 0.05,
  color,
  spacing = 3,
}: ScanLinesProps) {
  const stroke = color ?? colors.textPrimary;
  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { opacity }]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="scan-lines"
            patternUnits="userSpaceOnUse"
            width={spacing}
            height={spacing}
          >
            <Line x1="0" y1="0" x2={spacing} y2="0" stroke={stroke} strokeWidth="0.5" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#scan-lines)" />
      </Svg>
    </View>
  );
}
