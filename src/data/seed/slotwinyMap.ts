// ═══════════════════════════════════════════════════════════
// SEED: Słotwiny Arena — Map geometry & zones
// Mock polylines based on approximate Słotwiny mountain layout
// Ready for replacement with real GPX/GeoJSON later
// ═══════════════════════════════════════════════════════════

export interface TrailGeoSeed {
  trailId: string;
  startZone: { latitude: number; longitude: number; radiusM: number };
  finishZone: { latitude: number; longitude: number; radiusM: number };
  polyline: { latitude: number; longitude: number }[];
}

// Center of Słotwiny Arena — approximate summit/station area
export const SLOTWINY_CENTER = {
  latitude: 49.4185,
  longitude: 20.9575,
};

export const SLOTWINY_REGION = {
  ...SLOTWINY_CENTER,
  latitudeDelta: 0.016,
  longitudeDelta: 0.011,
};

// Lift line reference (kolej linowa 6-osobowa)
export const LIFT_LINE = {
  bottom: { latitude: 49.4130, longitude: 20.9570 },
  top: { latitude: 49.4248, longitude: 20.9572 },
};

export const trailGeoSeeds: TrailGeoSeed[] = [
  // 1. Gałgan Niebieska — 2700m, gentle flow, rider's left
  {
    trailId: 'galgan-niebieska',
    startZone: { latitude: 49.4248, longitude: 20.9548, radiusM: 30 },
    finishZone: { latitude: 49.4132, longitude: 20.9558, radiusM: 30 },
    polyline: [
      { latitude: 49.4248, longitude: 20.9548 },
      { latitude: 49.4242, longitude: 20.9545 },
      { latitude: 49.4234, longitude: 20.9548 },
      { latitude: 49.4226, longitude: 20.9544 },
      { latitude: 49.4218, longitude: 20.9548 },
      { latitude: 49.4210, longitude: 20.9545 },
      { latitude: 49.4202, longitude: 20.9550 },
      { latitude: 49.4194, longitude: 20.9547 },
      { latitude: 49.4186, longitude: 20.9552 },
      { latitude: 49.4178, longitude: 20.9548 },
      { latitude: 49.4170, longitude: 20.9553 },
      { latitude: 49.4162, longitude: 20.9550 },
      { latitude: 49.4154, longitude: 20.9555 },
      { latitude: 49.4146, longitude: 20.9552 },
      { latitude: 49.4138, longitude: 20.9556 },
      { latitude: 49.4132, longitude: 20.9558 },
    ],
  },

  // 2. Dookoła Świata Zielona — 3100m, longest trail, sweeping turns
  {
    trailId: 'dookola-swiata-zielona',
    startZone: { latitude: 49.4246, longitude: 20.9558, radiusM: 30 },
    finishZone: { latitude: 49.4128, longitude: 20.9568, radiusM: 30 },
    polyline: [
      { latitude: 49.4246, longitude: 20.9558 },
      { latitude: 49.4240, longitude: 20.9562 },
      { latitude: 49.4234, longitude: 20.9555 },
      { latitude: 49.4228, longitude: 20.9560 },
      { latitude: 49.4222, longitude: 20.9554 },
      { latitude: 49.4216, longitude: 20.9562 },
      { latitude: 49.4210, longitude: 20.9556 },
      { latitude: 49.4204, longitude: 20.9563 },
      { latitude: 49.4198, longitude: 20.9557 },
      { latitude: 49.4192, longitude: 20.9564 },
      { latitude: 49.4186, longitude: 20.9558 },
      { latitude: 49.4180, longitude: 20.9565 },
      { latitude: 49.4174, longitude: 20.9560 },
      { latitude: 49.4168, longitude: 20.9566 },
      { latitude: 49.4162, longitude: 20.9562 },
      { latitude: 49.4156, longitude: 20.9568 },
      { latitude: 49.4150, longitude: 20.9564 },
      { latitude: 49.4142, longitude: 20.9568 },
      { latitude: 49.4135, longitude: 20.9566 },
      { latitude: 49.4128, longitude: 20.9568 },
    ],
  },

  // 3. Kometa Niebieska — 2300m, rider's right, rhythmic berms
  {
    trailId: 'kometa-niebieska',
    startZone: { latitude: 49.4245, longitude: 20.9588, radiusM: 30 },
    finishZone: { latitude: 49.4130, longitude: 20.9595, radiusM: 30 },
    polyline: [
      { latitude: 49.4245, longitude: 20.9588 },
      { latitude: 49.4238, longitude: 20.9592 },
      { latitude: 49.4230, longitude: 20.9586 },
      { latitude: 49.4222, longitude: 20.9594 },
      { latitude: 49.4214, longitude: 20.9588 },
      { latitude: 49.4206, longitude: 20.9596 },
      { latitude: 49.4198, longitude: 20.9590 },
      { latitude: 49.4190, longitude: 20.9596 },
      { latitude: 49.4182, longitude: 20.9592 },
      { latitude: 49.4174, longitude: 20.9598 },
      { latitude: 49.4166, longitude: 20.9594 },
      { latitude: 49.4158, longitude: 20.9598 },
      { latitude: 49.4148, longitude: 20.9596 },
      { latitude: 49.4138, longitude: 20.9596 },
      { latitude: 49.4130, longitude: 20.9595 },
    ],
  },

  // 4. Dzida Czerwona — 1500m, steep and direct, minimal switchbacks
  {
    trailId: 'dzida-czerwona',
    startZone: { latitude: 49.4250, longitude: 20.9575, radiusM: 25 },
    finishZone: { latitude: 49.4135, longitude: 20.9582, radiusM: 25 },
    polyline: [
      { latitude: 49.4250, longitude: 20.9575 },
      { latitude: 49.4244, longitude: 20.9578 },
      { latitude: 49.4236, longitude: 20.9574 },
      { latitude: 49.4228, longitude: 20.9580 },
      { latitude: 49.4218, longitude: 20.9576 },
      { latitude: 49.4208, longitude: 20.9582 },
      { latitude: 49.4198, longitude: 20.9578 },
      { latitude: 49.4186, longitude: 20.9582 },
      { latitude: 49.4174, longitude: 20.9580 },
      { latitude: 49.4162, longitude: 20.9584 },
      { latitude: 49.4148, longitude: 20.9582 },
      { latitude: 49.4135, longitude: 20.9582 },
    ],
  },
];

export const getTrailGeo = (trailId: string) =>
  trailGeoSeeds.find((t) => t.trailId === trailId);
