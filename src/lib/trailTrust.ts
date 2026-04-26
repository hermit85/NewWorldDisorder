// ═══════════════════════════════════════════════════════════
// trailTrust — disclosure copy + Track A progress for ADR-012
// trust_tier × seed_source matrix.
//
// Promoted from inline duplicate in app/(tabs)/leaderboard.tsx
// and app/trail/[id].tsx after the third caller landed (admin
// review queue). Single source of truth for the "Trasa próbna ·
// 2 potwierdzenia do oficjalnego rankingu" copy that appears
// next to TrustBadge across the app.
// ═══════════════════════════════════════════════════════════

import type { SeedSource, TrustTier } from '@/data/types';

/**
 * Disclosure copy for the trust banner above the leaderboard /
 * trail header. Reads the (seed_source × trust_tier) state plus
 * Track A confirmation progress.
 *
 * Polish pluralization for the remaining-confirmation count
 * follows the standard 1 / 2-4 / 5+ rule.
 */
export function getTrustDisclosure(
  source: SeedSource,
  tier: TrustTier,
  confirmersCount = 0,
  confirmersNeeded = 3,
): string {
  if (tier === 'disputed') return 'Wyniki zamrożone · weryfikacja w toku';
  if (tier === 'verified') {
    return 'Trasa potwierdzona przez społeczność · oficjalne wyniki';
  }

  const remaining = Math.max(0, confirmersNeeded - confirmersCount);
  const progressSuffix =
    remaining > 0
      ? ` · ${remaining} ${formatConfirmationsRemaining(remaining)} do oficjalnego rankingu`
      : ' · czeka na zatwierdzenie';

  if (source === 'curator') {
    return `Trasa kuratora${progressSuffix}`;
  }
  return `Trasa próbna${progressSuffix}`;
}

function formatConfirmationsRemaining(n: number): string {
  if (n === 1) return 'potwierdzenie';
  if (n < 5) return 'potwierdzenia';
  return 'potwierdzeń';
}
