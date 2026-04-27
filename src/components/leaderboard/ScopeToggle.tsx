// ─────────────────────────────────────────────────────────────
// ScopeToggle — Tablica scope chips (DZIŚ · WEEKEND · SEZON · ALL-TIME).
//
// Active chip pops in accent green, others stay muted. Sezon is
// not yet backed by a distinct period in the API; the consumer
// owns mapping it (currently routes to `all_time` with a TODO at
// the call site).
// ─────────────────────────────────────────────────────────────

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fonts } from '@/theme/typography';

export type ScopeKey = 'today' | 'weekend' | 'season' | 'all_time';

// Display label only — the underlying period key (`all_time`) stays
// stable; "REKORDY" reads more like a racing chip and less SaaS than
// "ALL-TIME" without changing the data layer.
const LABELS: Record<ScopeKey, string> = {
  today: 'DZIŚ',
  weekend: 'WEEKEND',
  season: 'SEZON',
  all_time: 'REKORDY',
};

const ORDER: ScopeKey[] = ['today', 'weekend', 'season', 'all_time'];

export interface ScopeToggleProps {
  value: ScopeKey;
  onChange: (next: ScopeKey) => void;
  /** Disabled scopes still render but don't dispatch onChange.
      Used while the data layer can't honour them yet. */
  disabledScopes?: ScopeKey[];
}

export function ScopeToggle({ value, onChange, disabledScopes }: ScopeToggleProps) {
  const disabled = new Set(disabledScopes ?? []);
  return (
    <View style={styles.row}>
      {ORDER.map((scope) => {
        const isActive = scope === value;
        const isDisabled = disabled.has(scope);
        return (
          <Pressable
            key={scope}
            onPress={() => {
              if (isDisabled || isActive) return;
              onChange(scope);
            }}
            style={({ pressed }) => [
              styles.chip,
              isActive && styles.chipActive,
              isDisabled && styles.chipDisabled,
              pressed && !isActive && !isDisabled && styles.chipPressed,
            ]}
          >
            <Text
              style={[
                styles.chipLabel,
                isActive && styles.chipLabelActive,
                isDisabled && styles.chipLabelDisabled,
              ]}
            >
              {LABELS[scope]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  chipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipPressed: {
    backgroundColor: colors.accentDim,
    borderColor: colors.borderHot,
  },
  chipLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    fontWeight: '800',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  chipLabelActive: {
    color: colors.accentInk,
  },
  chipLabelDisabled: {
    color: colors.textTertiary,
  },
});
