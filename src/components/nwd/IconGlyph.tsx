// ─────────────────────────────────────────────────────────────
// IconGlyph — canonical 12-glyph set
//
// design-system/icons.md is the entire spec. 24×24 grid, stroke
// 1.6, square caps, miter joins. Don't add new glyphs without
// auditing — every addition dilutes recognition.
//
// Variants:
//   default — stroke currentColor, fill none (most uses)
//   accent  — stroke colors.accent (armed / active state)
//   filled  — fill currentColor (only `rec` and verified badge bg)
//
// Use everywhere instead of emoji. NEVER swap to Lucide / Heroicons —
// they round their corners which breaks the brand visual.
// ─────────────────────────────────────────────────────────────
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors } from '@/theme/colors';

export type IconName =
  | 'gate' | 'flag' | 'split' | 'podium' | 'verified' | 'lock'
  | 'lift' | 'line' | 'spot' | 'bike' | 'timer' | 'rec'
  // Common nav/utility additions kept inside the same visual rules
  // (square caps, miter joins, stroke 1.6). The 12 above are the
  // brand set; these support nav chrome.
  | 'arrow-left' | 'arrow-right' | 'chevron-right' | 'plus' | 'x';

export interface IconGlyphProps {
  name: IconName;
  size?: number;
  variant?: 'default' | 'accent' | 'filled';
  color?: string;
}

export function IconGlyph({
  name,
  size = 24,
  variant = 'default',
  color,
}: IconGlyphProps) {
  const stroke =
    variant === 'accent' ? colors.accent : color ?? 'currentColor';
  const fill =
    variant === 'filled' ? (color ?? 'currentColor') : 'none';
  const strokeProps = {
    stroke,
    strokeWidth: 1.6,
    strokeLinecap: 'square' as const,
    strokeLinejoin: 'miter' as const,
    fill: 'none' as const,
  };

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
    >
      {renderPath(name, strokeProps, stroke)}
    </Svg>
  );
}

function renderPath(
  name: IconName,
  p: {
    stroke: string;
    strokeWidth: number;
    strokeLinecap: 'square';
    strokeLinejoin: 'miter';
    fill: 'none';
  },
  accentStroke: string,
) {
  switch (name) {
    case 'gate':
      return (
        <G {...p}>
          <Path d="M5 4 L5 20 M19 4 L19 20" />
          <Path d="M5 8 L19 8 M5 12 L19 12 M5 16 L19 16" />
        </G>
      );
    case 'flag':
      return (
        <G {...p}>
          <Path d="M5 21 L5 4" />
          <Path d="M5 5 L19 5 L17 9 L19 13 L5 13" />
        </G>
      );
    case 'split':
      return <Path {...p} d="M4 12 L20 12 M4 12 L8 8 M4 12 L8 16 M20 12 L16 8 M20 12 L16 16" />;
    case 'podium':
      return <Path {...p} d="M3 21 L21 21 M9 21 L9 11 L15 11 L15 21 M3 21 L3 15 L9 15 M21 21 L21 17 L15 17" />;
    case 'verified':
      return <Path {...p} d="M3 12 L9 18 L21 6" />;
    case 'lock':
      return <Path {...p} d="M6 11 L18 11 L18 21 L6 21 Z M9 11 L9 7 A3 3 0 0 1 15 7 L15 11" />;
    case 'lift':
      return <Path {...p} d="M3 6 L21 14 M5 5 L7 7 M11 8 L13 10 M17 11 L19 13" />;
    case 'line':
      return <Path {...p} d="M3 18 C8 4, 16 20, 21 6" />;
    case 'spot':
      return (
        <G {...p}>
          <Circle cx="12" cy="10" r="4" />
          <Path d="M12 14 L12 21 M8 21 L16 21" />
        </G>
      );
    case 'bike':
      return (
        <G {...p}>
          <Circle cx="6" cy="16" r="4" />
          <Circle cx="18" cy="16" r="4" />
          <Path d="M6 16 L11 8 L18 16 M11 8 L8 8 M11 8 L13 5" />
        </G>
      );
    case 'timer':
      return (
        <G {...p}>
          <Circle cx="12" cy="13" r="7" />
          <Path d="M12 13 L12 9 M9 4 L15 4" />
        </G>
      );
    case 'rec':
      // Filled center dot (always accent), open ring outside.
      return (
        <G>
          <Circle cx="12" cy="12" r="4" fill={accentStroke} />
          <Circle
            cx="12" cy="12" r="9"
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill="none"
          />
        </G>
      );
    case 'arrow-left':
      return <Path {...p} d="M19 12 L5 12 M11 18 L5 12 L11 6" />;
    case 'arrow-right':
      return <Path {...p} d="M5 12 L19 12 M13 6 L19 12 L13 18" />;
    case 'chevron-right':
      return <Path {...p} d="M9 6 L15 12 L9 18" />;
    case 'plus':
      return <Path {...p} d="M12 5 L12 19 M5 12 L19 12" />;
    case 'x':
      return <Path {...p} d="M6 6 L18 18 M18 6 L6 18" />;
    default:
      return null;
  }
}
