// Build TruthMapData from a real run trace + verification result

import { TruthMapData, VerificationResult } from '@/data/verificationTypes';
import { GpsPoint } from './gps';
import { TrailGeoSeed } from '@/data/seed/slotwinyMap';

export function buildRealTruthMap(
  geo: TrailGeoSeed,
  points: GpsPoint[],
  verification: VerificationResult
): TruthMapData {
  return {
    officialLine: geo.polyline,
    riderLine: points.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
    startGate: verification.startGate,
    finishGate: verification.finishGate,
    checkpoints: verification.checkpoints,
    deviations: verification.corridor.deviations,
    verification,
  };
}
