// ═══════════════════════════════════════════════════════════
// BottomBand — sticky season/context strip pinned at the
// bottom of non-tab screens (Auth, Help, Settings, Empty states).
//
// Variants follow race-state semantics:
//   live      — accent border @ 0.20, pulse dot   ("SEZON 01 · LIVE")
//   warning   — warn border @ 0.25, pulse dot     ("OCZEKIWANIE")
//   verified  — accent border @ 0.40, slow dot    ("SYGNAŁ ZWERYFIKOWANY")
//   idle      — hairline border, static dot       ("OFFLINE")
//
// 0.5px borderWidth gives the hairline-on-OLED look RN uses
// elsewhere; 1.0 would render too heavy against the panel surface.
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';
import { LiveDot, type LiveDotMode } from './LiveDot';

export type BottomBandVariant = 'live' | 'warning' | 'verified' | 'idle';

export interface BottomBandProps {
  /** Mono CAPS line (e.g. "SEZON 01 · LIVE"). */
  status: string;
  /** Optional secondary line (Inter 11 muted). */
  context?: string;
  variant?: BottomBandVariant;
}

const VARIANT: Record<BottomBandVariant, {
  color: string;
  border: string;
  dotMode: LiveDotMode;
}> = {
  live:     { color: colors.accent,            border: 'rgba(0,255,135,0.20)',   dotMode: 'pulse' },
  warning:  { color: colors.warn,              border: 'rgba(255,176,32,0.25)',  dotMode: 'pulse' },
  verified: { color: colors.accent,            border: 'rgba(0,255,135,0.40)',   dotMode: 'verified' },
  idle:     { color: 'rgba(242,244,243,0.5)',  border: 'rgba(255,255,255,0.06)', dotMode: 'none' },
};

export const BottomBand = memo(function BottomBand({
  status,
  context,
  variant = 'live',
}: BottomBandProps) {
  const v = VARIANT[variant];
  return (
    <View style={[styles.container, { borderColor: v.border }]}>
      <LiveDot size={6} color={v.color} mode={v.dotMode} />
      <View style={styles.textBlock}>
        <Text style={[styles.status, { color: v.color }]}>{status}</Text>
        {context ? <Text style={styles.context}>{context}</Text> : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    backgroundColor: colors.panel,
    borderWidth: 0.5,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  textBlock: {
    flex: 1,
  },
  status: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  context: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    color: 'rgba(242,244,243,0.7)',
    marginTop: 2,
  },
});
