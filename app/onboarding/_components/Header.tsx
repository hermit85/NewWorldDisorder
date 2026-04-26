// ═══════════════════════════════════════════════════════════
// Onboarding Header — thin wrapper on the shared NWDHeader
// brand primitive. Maps the slide pageIndex/pageCount into the
// pagination right-context shape. Bit-perfect with the previous
// hand-rolled implementation (NWDHeader's defaults are calibrated
// to match it exactly).
// ═══════════════════════════════════════════════════════════

import { memo } from 'react';
import { NWDHeader } from '@/components/nwd/brand';

export interface OnboardingHeaderProps {
  pageIndex: number; // 0-based
  pageCount: number;
}

export const OnboardingHeader = memo(function OnboardingHeader({
  pageIndex,
  pageCount,
}: OnboardingHeaderProps) {
  return (
    <NWDHeader
      rightContext={{
        type: 'pagination',
        current: pageIndex + 1,
        total: pageCount,
      }}
    />
  );
});
