// ─────────────────────────────────────────────────────────────
// Rider passport — derived data for the JA tab.
//
// JA is not a profile screen, it's a passport. The numbers shown
// in DOROBEK and the rows in REKORDY OSOBISTE all read off real
// data the rider can verify. No invented "Obronione #1" or fake
// "Korony"; if a metric isn't backed by a query, it doesn't ship.
//
// Sources reused (no new queries):
//   - useTablicaSections      → bike-park sections + PB per trail
//   - useStreakState          → current passa
//   - useProfile              → totalPbs, pioneeredVerifiedCount
// ─────────────────────────────────────────────────────────────

import type { TablicaSection, TablicaTrailRow } from '@/hooks/useTablicaSections';

export interface PassportRecord {
  trailId: string;
  trailName: string;
  spotName: string;
  pbMs: number;
  /** All-time leaderboard position. Null when not yet ranked. */
  position: number | null;
}

export interface PassportData {
  /** Distinct bike parks the rider has ridden in. */
  bikeParksCount: number;
  /** Trails where the rider holds a personal best. */
  pbCount: number;
  /** Pioneer trail count — read straight from profile. */
  pioneerCount: number;
  /** Current streak in days. We deliberately label this "PASSA"
   *  (not "NAJDŁUŻSZA PASSA") because longest is not yet tracked
   *  in the data layer. */
  passaDays: number;
  /** Rider's PBs across every trail they've ridden, sorted by
   *  position then time. */
  records: PassportRecord[];
}

export interface DerivePassportInput {
  sections: TablicaSection[];
  pioneerCount: number;
  passaDays: number;
}

function rowToRecord(row: TablicaTrailRow, spotName: string): PassportRecord | null {
  if (row.userPbMs == null) return null;
  return {
    trailId: row.trail.id,
    trailName: row.trail.name,
    spotName,
    pbMs: row.userPbMs,
    position: row.userPosition,
  };
}

export function derivePassport(input: DerivePassportInput): PassportData {
  const { sections, pioneerCount, passaDays } = input;

  const records: PassportRecord[] = [];
  for (const section of sections) {
    for (const row of section.trails) {
      const rec = rowToRecord(row, section.spot.name);
      if (rec) records.push(rec);
    }
  }

  // Sort: ranked positions ascend first (#1 wins), unranked tail
  // sorts by faster PB. This lets the passport open with the
  // strongest evidence at the top.
  records.sort((a, b) => {
    if (a.position != null && b.position != null) return a.position - b.position;
    if (a.position != null) return -1;
    if (b.position != null) return 1;
    return a.pbMs - b.pbMs;
  });

  return {
    bikeParksCount: sections.filter((s) => s.trails.length > 0).length,
    pbCount: records.length,
    pioneerCount,
    passaDays,
    records,
  };
}
