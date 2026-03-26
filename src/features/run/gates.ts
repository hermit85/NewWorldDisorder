// ═══════════════════════════════════════════════════════════
// Gate Definitions — official start/finish gate configs
// per trail at Słotwiny Arena
//
// PHILOSOPHY: Anti-frustration first.
// Start: reasonably disciplined (needs ARMED first).
// Finish: maximally forgiving (if you rode the trail, it counts).
//
// Gate bearings are measured as the trail direction at the gate,
// in degrees from true north. Downhill direction.
// ═══════════════════════════════════════════════════════════

import { TrailGateConfig, GateDefinition } from './types';
import { computeHeading } from './geometry';
import { trailGeoSeeds } from '@/data/seed/slotwinyMap';

// ── Default gate parameters ──

const DEFAULT_START_GATE: Omit<GateDefinition, 'center' | 'trailBearing'> = {
  lineWidthM: 20,
  zoneDepthM: 12,
  entryRadiusM: 35,
  headingToleranceDeg: 60,
  minTriggerSpeedKmh: 3,
};

const DEFAULT_FINISH_GATE: Omit<GateDefinition, 'center' | 'trailBearing'> = {
  lineWidthM: 25,
  zoneDepthM: 25,
  entryRadiusM: 40,
  headingToleranceDeg: 90, // finish is more forgiving
  minTriggerSpeedKmh: 2,   // slower trigger for finish
};

// ── Auto-compute bearing from first/last polyline segments ──

function computeStartBearing(poly: { latitude: number; longitude: number }[]): number {
  if (poly.length < 2) return 180; // default: southward
  return computeHeading(poly[0], poly[1]);
}

function computeFinishBearing(poly: { latitude: number; longitude: number }[]): number {
  if (poly.length < 2) return 180;
  return computeHeading(poly[poly.length - 2], poly[poly.length - 1]);
}

// ── Trail-specific metadata ──

interface TrailMeta {
  trailId: string;
  trailName: string;
  expectedLengthM: number;
  minDurationSec: number;
  minDistanceFraction: number;
}

const trailMeta: TrailMeta[] = [
  {
    trailId: 'galgan-niebieska',
    trailName: 'Gałgan Niebieska',
    expectedLengthM: 2400,
    minDurationSec: 45,       // nobody rides 2.4km in under 45s
    minDistanceFraction: 0.6, // at least 60% of expected distance
  },
  {
    trailId: 'dookola-swiata-zielona',
    trailName: 'Dookoła Świata Zielona',
    expectedLengthM: 3100,
    minDurationSec: 60,
    minDistanceFraction: 0.6,
  },
  {
    trailId: 'kometa-niebieska',
    trailName: 'Kometa Niebieska',
    expectedLengthM: 2300,
    minDurationSec: 40,
    minDistanceFraction: 0.6,
  },
  {
    trailId: 'dzida-czerwona',
    trailName: 'Dzida Czerwona',
    expectedLengthM: 1500,
    minDurationSec: 25,       // short steep trail
    minDistanceFraction: 0.65,
  },
];

// ── Build gate configs from seed data + metadata ──

export function buildTrailGateConfigs(): TrailGateConfig[] {
  return trailGeoSeeds.map((geo) => {
    const meta = trailMeta.find((m) => m.trailId === geo.trailId);

    const startBearing = computeStartBearing(geo.polyline);
    const finishBearing = computeFinishBearing(geo.polyline);

    return {
      trailId: geo.trailId,
      trailName: meta?.trailName ?? geo.trailId,
      expectedLengthM: meta?.expectedLengthM ?? 2000,
      minDurationSec: meta?.minDurationSec ?? 30,
      minDistanceFraction: meta?.minDistanceFraction ?? 0.6,
      startGate: {
        center: { latitude: geo.startZone.latitude, longitude: geo.startZone.longitude },
        trailBearing: startBearing,
        ...DEFAULT_START_GATE,
      },
      finishGate: {
        center: { latitude: geo.finishZone.latitude, longitude: geo.finishZone.longitude },
        trailBearing: finishBearing,
        ...DEFAULT_FINISH_GATE,
      },
    };
  });
}

// ── Get gate config for a specific trail ──

let _cachedConfigs: TrailGateConfig[] | null = null;

export function getTrailGateConfig(trailId: string): TrailGateConfig | null {
  if (!_cachedConfigs) {
    _cachedConfigs = buildTrailGateConfigs();
  }
  return _cachedConfigs.find((c) => c.trailId === trailId) ?? null;
}

// ── Get all gate configs ──

export function getAllTrailGateConfigs(): TrailGateConfig[] {
  if (!_cachedConfigs) {
    _cachedConfigs = buildTrailGateConfigs();
  }
  return _cachedConfigs;
}
