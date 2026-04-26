// ═══════════════════════════════════════════════════════════
// PageLabel — small mono kicker with optional animated dot.
//
// Sits below NWDHeader on non-tab screens, above the headline
// block. Variants follow race-state semantics:
//   default  — accent (animated pulse — "live / live arena")
//   warning  — warn (static)
//   danger   — danger (static)
//   neutral  — muted (static)
//
// Pixel-perfect dot alignment (per cc_pagelabel_pixel_perfect_update):
//   Container uses alignItems: 'flex-end' so the dot's bottom edge
//   sits on the Text baseline. A small marginBottom nudges the dot
//   to the optical center of cap-height (visual midline of "D" in
//   "DOŁĄCZ"), since flex-end alone aligns to the Text bounding box
//   bottom — which sits below the optical baseline by the descender
//   space of the font.
//
// Offsets are calibrated to JetBrains Mono (cap-height ≈ 0.7em);
// shipped app currently falls back to Menlo (iOS) / monospace
// (Android) which have slightly different cap-height ratios. After
// implementation, screenshot at zoom 4× and tweak the platform
// offset by ±1px if the dot is misaligned with cap-mid.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot } from './LiveDot';

export type PageLabelVariant = 'default' | 'warning' | 'danger' | 'neutral';

export interface PageLabelProps {
  text: string;
  variant?: PageLabelVariant;
  showDot?: boolean;
}

const VARIANT_COLOR: Record<PageLabelVariant, string> = {
  default: colors.accent,
  warning: colors.warn,
  danger: colors.danger,
  neutral: 'rgba(242,244,243,0.6)',
};

const DOT_MARGIN_BOTTOM = Platform.OS === 'android' ? 5 : 4;

export const PageLabel = memo(function PageLabel({
  text,
  variant = 'default',
  showDot = true,
}: PageLabelProps) {
  const color = VARIANT_COLOR[variant];
  return (
    <View style={styles.container}>
      {showDot && (
        <View style={styles.dotWrap}>
          <LiveDot
            size={6}
            color={color}
            mode={variant === 'default' ? 'pulse' : 'none'}
          />
        </View>
      )}
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    // CRITICAL — flex-end aligns the dot's bottom edge to the Text
    // baseline. 'center' would visually drop the dot too low because
    // the Text bounding box includes descender space.
    alignItems: 'flex-end',
    paddingHorizontal: 24,
    marginTop: 32,
    marginBottom: 18,
  },
  dotWrap: {
    marginRight: 10,
    marginBottom: DOT_MARGIN_BOTTOM,
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    // No explicit lineHeight — defaults let flex-end alignment work
    // off the Text's intrinsic baseline metrics.
  },
});
