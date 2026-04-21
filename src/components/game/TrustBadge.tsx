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
import { hudColors, hudTypography } from '@/theme/gameHud';
import type { SeedSource, TrustTier } from '@/data/types';

export interface TrustBadgeProps {
  seedSource: SeedSource | null;
  trustTier: TrustTier | null;
  size?: 'sm' | 'md';
}

interface Variant {
  color: string;
  label: string;
}

/** Four states — disputed wins over tier, else verified wins over source. */
function getVariant(source: SeedSource, tier: TrustTier): Variant {
  if (tier === 'disputed') {
    return { color: hudColors.trustDisputed, label: 'TRASA SPORNA' };
  }
  if (tier === 'verified') {
    return { color: hudColors.trustVerified, label: 'POTWIERDZONA' };
  }
  // tier === 'provisional' → variant depends on source
  if (source === 'curator') {
    return { color: hudColors.trustCuratorProvisional, label: 'TRASA KURATORA' };
  }
  return { color: hudColors.trustRiderProvisional, label: 'TRASA PRÓBNA' };
}

export function TrustBadge({ seedSource, trustTier, size = 'md' }: TrustBadgeProps) {
  // Draft trails have neither axis stamped yet — render nothing rather
  // than a "loading" placeholder that the user has to mentally decode.
  if (!seedSource || !trustTier) return null;

  const variant = getVariant(seedSource, trustTier);
  const sizeStyle = size === 'sm' ? styles.sm : styles.md;
  const dotSize = size === 'sm' ? styles.dotSm : styles.dotMd;
  const labelStyle = size === 'sm' ? styles.labelSm : styles.labelMd;

  return (
    <View
      style={[styles.container, sizeStyle, { borderColor: variant.color }]}
      accessibilityLabel={`Status trasy: ${variant.label}`}
    >
      <View style={[dotSize, { backgroundColor: variant.color }]} />
      <Text style={[labelStyle, { color: variant.color }]}>{variant.label}</Text>
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
  labelSm: {
    ...hudTypography.labelSmall,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  labelMd: {
    ...hudTypography.label,
    fontSize: 10,
    letterSpacing: 2,
  },
});
