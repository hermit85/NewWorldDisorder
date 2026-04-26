// ═══════════════════════════════════════════════════════════
// TrustBadge — Sprint 4 (ADR-012) trust disclosure pill.
//
// Four visual states derived from the (seed_source × trust_tier)
// matrix. Rendered on the trail header + above leaderboard entries
// (GPT Rule 2: mandatory trust disclosure).
//
// Copy is intentionally honest — a curator-seeded, community-
// unconfirmed trail reads "TRASA KURATORA", not "POTWIERDZONA",
// even though curator status commands more initial trust.
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet } from 'react-native';
import { colors } from '@/theme/colors';
import type { SeedSource, TrustTier } from '@/data/types';

export interface TrustBadgeProps {
  seedSource: SeedSource | null;
  trustTier: TrustTier | null;
  /** ADR-012 Phase 2.4 — when provisional, show progress toward Track A
   *  auto-verify ("TRASA PRÓBNA · 1/3 POTWIERDZEŃ"). Threshold defaults
   *  to 3 (the Track A bar in fn_maybe_verify_trail). Pass null to hide. */
  confirmersCount?: number | null;
  confirmersNeeded?: number;
  size?: 'sm' | 'md';
}

interface Variant {
  color: string;
  label: string;
}

/** Four states — disputed wins over tier, else verified wins over source. */
function getVariant(source: SeedSource, tier: TrustTier): Variant {
  if (tier === 'disputed') {
    return { color: colors.danger, label: 'TRASA SPORNA' };
  }
  if (tier === 'verified') {
    return { color: colors.accent, label: 'POTWIERDZONA' };
  }
  // tier === 'provisional' → variant depends on source
  if (source === 'curator') {
    return { color: colors.warn, label: 'TRASA KURATORA' };
  }
  return { color: colors.diffBlue, label: 'TRASA PRÓBNA' };
}

export function TrustBadge({
  seedSource,
  trustTier,
  confirmersCount,
  confirmersNeeded = 3,
  size = 'md',
}: TrustBadgeProps) {
  // Draft trails have neither axis stamped yet — render nothing rather
  // than a "loading" placeholder that the user has to mentally decode.
  if (!seedSource || !trustTier) return null;

  const variant = getVariant(seedSource, trustTier);
  const sizeStyle = size === 'sm' ? styles.sm : styles.md;
  const dotSize = size === 'sm' ? styles.dotSm : styles.dotMd;
  const labelStyle = size === 'sm' ? styles.labelSm : styles.labelMd;

  // Show "N/3" progress only on provisional rows where the consumer
  // passes a count. Verified / disputed / curator-trusted skip it.
  const showProgress =
    trustTier === 'provisional' &&
    typeof confirmersCount === 'number' &&
    confirmersCount >= 0;

  const accessibilityLabel = showProgress
    ? `Status trasy: ${variant.label}, ${confirmersCount} z ${confirmersNeeded} potwierdzeń`
    : `Status trasy: ${variant.label}`;

  return (
    <View
      style={[styles.container, sizeStyle, { borderColor: variant.color }]}
      accessibilityLabel={accessibilityLabel}
    >
      <View style={[dotSize, { backgroundColor: variant.color }]} />
      <Text style={[labelStyle, { color: variant.color }]}>{variant.label}</Text>
      {showProgress ? (
        <Text style={[labelStyle, { color: variant.color, opacity: 0.65 }]}>
          {` · ${confirmersCount}/${confirmersNeeded}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  sm: { paddingHorizontal: 6, paddingVertical: 3 },
  md: { paddingHorizontal: 8, paddingVertical: 4 },
  dotSm: { width: 5, height: 5, borderRadius: 3 },
  dotMd: { width: 6, height: 6, borderRadius: 3 },
  // TrustBadge labels stay on Rajdhani display — same call as
  // PioneerBadge: trust disclosure reads as race-state badge, not
  // mono system text.
  labelSm: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  labelMd: {
    fontFamily: 'Rajdhani_700Bold',
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
