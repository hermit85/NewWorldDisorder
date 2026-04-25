// ─────────────────────────────────────────────────────────────
// HudPanel — game-HUD card (per components.md § HudPanel)
//
// Anatomy:
//   ┌─ [LABEL] ────────── [STATUS] ─┐
//   │                                │
//   │       {children}               │
//   │                                │
//   └────────────────────────────────┘
//
// Optional accent left strip (3px) when accent prop is true.
// Optional 4 corner brackets when corners prop is true.
// Background: e2 panel + hairline border (or borderHot if accent).
// ─────────────────────────────────────────────────────────────
import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { spacing, radii } from '@/theme/spacing';

export interface HudPanelProps {
  /** Top-left mono CAPS label. */
  title?: string | null;
  /** Top-right slot — usually a Pill or text. */
  status?: ReactNode;
  /** Adds a 3px left accent strip to mark "armed" / important panels. */
  accent?: boolean;
  /** Adds 4 corner brackets at the panel edges. */
  corners?: boolean;
  /** Padding override (default: spacing.pad). */
  padding?: number;
  children: ReactNode;
  style?: ViewStyle;
}

function CornerBrackets() {
  return (
    <>
      <View style={[styles.corner, styles.cornerTL]} />
      <View style={[styles.corner, styles.cornerTR]} />
      <View style={[styles.corner, styles.cornerBL]} />
      <View style={[styles.corner, styles.cornerBR]} />
    </>
  );
}

export function HudPanel({
  title,
  status,
  accent = false,
  corners = false,
  padding,
  children,
  style,
}: HudPanelProps) {
  return (
    <View
      style={[
        styles.container,
        accent && styles.containerAccent,
        { padding: padding ?? spacing.pad },
        style,
      ]}
    >
      {accent && <View style={styles.accentStrip} />}
      {corners && <CornerBrackets />}

      {(title || status) && (
        <View style={styles.header}>
          {title ? (
            <Text style={styles.title} numberOfLines={1}>
              {title.toUpperCase()}
            </Text>
          ) : <View style={styles.spacer} />}
          {status ?? null}
        </View>
      )}

      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.card,
    position: 'relative',
    overflow: 'hidden',
  },
  containerAccent: {
    borderColor: colors.borderHot,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  accentStrip: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: colors.accent,
  },
  // Corner brackets — 14×14 inset 8px, stroke 1.5 accent.
  corner: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderColor: colors.accent,
  },
  cornerTL: { top: 8, left: 8, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 1.5, borderRightWidth: 1.5 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 1.5, borderLeftWidth: 1.5 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 1.5, borderRightWidth: 1.5 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: spacing.sm,
  },
  spacer: { flex: 1 },
  title: {
    ...typography.label,
    flex: 1,
    color: colors.accent,
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 2.64, // 0.24em
  },
  body: {
    minHeight: 0,
  },
});
