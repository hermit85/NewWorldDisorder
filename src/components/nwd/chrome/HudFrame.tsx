// ─────────────────────────────────────────────────────────────
// HudFrame — composite chrome wrapper.
//
// One opt-in prop per primitive (corners / scanLines / raceNumber /
// systemText) so a screen can dial in only the chrome it needs.
// Nothing about HudFrame mutates layout — it positions decorative
// children absolutely over the wrapped tree.
//
// Pattern 4 in design-system/patterns.md: full-frame is for run
// flow + onboarding + leaderboard hero. Settings / profile edit /
// auth get NO HudFrame — too much chrome on utility screens.
// ─────────────────────────────────────────────────────────────
import { type ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { CornerBrackets } from './CornerBrackets';
import { ScanLines } from './ScanLines';
import { RaceNumber } from './RaceNumber';
import { SystemText, type SystemTextSlot } from './SystemText';

export interface HudFrameProps {
  children: ReactNode;
  /** Render 4 corner brackets. Default true. */
  corners?: boolean;
  /** Render CRT scan-line overlay. `true` uses 0.05 opacity; pass a number to override. */
  scanLines?: boolean | number;
  /** Render a 2-digit watermark. Pass a value (rank number, slot id, etc.). */
  raceNumber?: string | number;
  /** Pin tiny mono captions to corners. */
  systemText?: Partial<Record<SystemTextSlot, string>>;
  /** Override accent color used by the corner brackets. */
  accent?: string;
  style?: ViewStyle;
}

export function HudFrame({
  children,
  corners = true,
  scanLines = false,
  raceNumber,
  systemText,
  accent,
  style,
}: HudFrameProps) {
  const scanOpacity = typeof scanLines === 'number' ? scanLines : 0.05;
  return (
    <View style={[styles.frame, style]}>
      {children}

      {raceNumber !== undefined && <RaceNumber n={raceNumber} />}
      {scanLines && <ScanLines opacity={scanOpacity} />}
      {corners && <CornerBrackets color={accent} />}

      {systemText?.tl && <SystemText slot="tl">{systemText.tl}</SystemText>}
      {systemText?.tr && <SystemText slot="tr">{systemText.tr}</SystemText>}
      {systemText?.bl && <SystemText slot="bl">{systemText.bl}</SystemText>}
      {systemText?.br && <SystemText slot="br">{systemText.br}</SystemText>}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    position: 'relative',
  },
});
