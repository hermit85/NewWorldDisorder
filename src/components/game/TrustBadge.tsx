// ═══════════════════════════════════════════════════════════
// TrustBadge — Ye brutalist (ADR-013).
//
// 0.5px outline pill in trust color, mono label 9pt uppercase
// letter-spaced. No fill. Jersey-embroidery feel.
// ═══════════════════════════════════════════════════════════

import { View, Text, StyleSheet } from 'react-native';
import { hudColors, hudType } from '@/theme/gameHud';
import type { SeedSource, TrustTier } from '@/data/types';

export interface TrustBadgeProps {
  seedSource: SeedSource | null;
  trustTier: TrustTier | null;
  size?: 'sm' | 'md';
}

interface Variant { color: string; label: string; }

function getVariant(source: SeedSource, tier: TrustTier): Variant {
  if (tier === 'disputed')  return { color: hudColors.trust.disputed, label: 'TRASA SPORNA' };
  if (tier === 'verified')  return { color: hudColors.trust.verified, label: 'POTWIERDZONA' };
  if (source === 'curator') return { color: hudColors.trust.curator,  label: 'TRASA KURATORA' };
  return { color: hudColors.trust.rider, label: 'TRASA PRÓBNA' };
}

export function TrustBadge({ seedSource, trustTier, size = 'md' }: TrustBadgeProps) {
  if (!seedSource || !trustTier) return null;
  const v = getVariant(seedSource, trustTier);
  const pad = size === 'sm' ? { h: 6, v: 2 } : { h: 8, v: 3 };

  return (
    <View
      style={[
        styles.base,
        { borderColor: v.color, paddingHorizontal: pad.h, paddingVertical: pad.v },
      ]}
      accessibilityLabel={`Status trasy: ${v.label}`}
    >
      <Text style={[styles.label, { color: v.color, fontSize: size === 'sm' ? 8 : 9 }]}>
        {v.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    ...hudType.labelSm,
    letterSpacing: 2,
  },
});
