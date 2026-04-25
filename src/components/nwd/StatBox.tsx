// ─────────────────────────────────────────────────────────────
// StatBox — labeled metric tile (per ui.jsx StatBox spec)
//
// Anatomy:
//   [LABEL]               mono micro CAPS muted
//   [VALUE][unit]         display 700 (or accent if accent prop)
//   [SUB]                 mono caption muted (optional)
//
// Used in 3-col stat grids on spot detail / trail detail / profile
// (Trasy / Riderzy / Zjazdy etc).
// ─────────────────────────────────────────────────────────────
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/theme/colors';
import { typography } from '@/theme/typography';
import { radii } from '@/theme/spacing';

export interface StatBoxProps {
  label: string;
  value: string | number;
  unit?: string;
  /** Tint value in accent. */
  accent?: boolean;
  /** Hero variant — fontSize 32 vs default 22. */
  big?: boolean;
  sub?: string | null;
  style?: ViewStyle;
}

export function StatBox({
  label,
  value,
  unit,
  accent = false,
  big = false,
  sub,
  style,
}: StatBoxProps) {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text
          style={[
            big ? styles.valueBig : styles.value,
            accent && styles.valueAccent,
          ]}
        >
          {value}
        </Text>
        {unit ? (
          <Text style={[big ? styles.unitBig : styles.unit]}>{unit}</Text>
        ) : null}
      </View>
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    gap: 6,
    minWidth: 0,
  },
  label: {
    ...typography.micro,
    fontSize: 9.5,
    letterSpacing: 1.33, // 0.14em @ 9.5
    color: colors.textTertiary,
    fontWeight: '600',
    textTransform: 'uppercase',
    fontFamily: 'Inter_700Bold',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    ...typography.lead,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 22,
    lineHeight: 22,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.11,
    fontVariant: ['tabular-nums'],
  },
  valueBig: {
    ...typography.title,
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 32,
    lineHeight: 32,
    color: colors.textPrimary,
    fontWeight: '700',
    letterSpacing: -0.32,
    fontVariant: ['tabular-nums'],
  },
  valueAccent: {
    color: colors.accent,
  },
  unit: {
    ...typography.body,
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  unitBig: {
    ...typography.body,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  sub: {
    ...typography.micro,
    fontSize: 10,
    color: colors.textTertiary,
    letterSpacing: 0.4,
    fontFamily: 'Inter_500Medium',
  },
});
