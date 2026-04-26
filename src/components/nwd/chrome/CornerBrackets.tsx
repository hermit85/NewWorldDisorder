// ─────────────────────────────────────────────────────────────
// CornerBrackets — 4 L-shaped brackets pinned to the screen corners.
// Pure decorative chrome. No props on content; sits on top of an
// already-rendered tree. Use directly when you don't need the full
// HudFrame (just the cornering bracket signal).
//
// Default per components.md § Chrome primitives: 14×14 arm length,
// 8px inset, stroke 1.5 accent.
// ─────────────────────────────────────────────────────────────
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '@/theme/colors';

export interface CornerBracketsProps {
  /** Bracket arm length in px. */
  size?: number;
  /** Distance from edge to the bracket's outer corner. */
  inset?: number;
  /** Stroke width. */
  weight?: number;
  /** Stroke color (defaults to accent green). */
  color?: string;
}

export function CornerBrackets({
  size = 14,
  inset = 8,
  weight = 1.5,
  color,
}: CornerBracketsProps) {
  const stroke = color ?? colors.accent;
  const common = {
    stroke,
    strokeWidth: weight,
    fill: 'none' as const,
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
  };
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Svg width={size} height={size} style={[styles.corner, { top: inset, left: inset }]}>
        <Path {...common} d={`M0 ${size} L0 0 L${size} 0`} />
      </Svg>
      <Svg width={size} height={size} style={[styles.corner, { top: inset, right: inset }]}>
        <Path {...common} d={`M0 0 L${size} 0 L${size} ${size}`} />
      </Svg>
      <Svg width={size} height={size} style={[styles.corner, { bottom: inset, left: inset }]}>
        <Path {...common} d={`M0 0 L0 ${size} L${size} ${size}`} />
      </Svg>
      <Svg width={size} height={size} style={[styles.corner, { bottom: inset, right: inset }]}>
        <Path {...common} d={`M0 ${size} L${size} ${size} L${size} 0`} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  corner: { position: 'absolute' },
});
