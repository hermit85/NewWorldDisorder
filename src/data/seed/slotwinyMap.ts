// ═══════════════════════════════════════════════════════════
// SEED: Słotwiny Arena — Map geometry & zones
// Trail polylines based on Słotwiny bike park layout
// Ready for replacement with real GPX/GeoJSON data
//
// Geometry source: manual trace from official Grupa Pingwina
// trail map. Approximate but spatially coherent — no zigzags,
// no decorative shapes. Each trail has a distinct corridor.
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
  // ────────────────────────────────────────────────────────
  // 1. Gałgan Niebieska — 2700m, gentle flow, rider's left
  //    Sweeping wide turns, stays west of lift line
  //    Machine-built berms and tables
  // ────────────────────────────────────────────────────────
  {
    trailId: 'galgan-niebieska',
    startZone: { latitude: 49.4248, longitude: 20.9548, radiusM: 30 },
    finishZone: { latitude: 49.4132, longitude: 20.9555, radiusM: 30 },
    polyline: [
      { latitude: 49.4248, longitude: 20.9548 },  // start gate — summit west
      { latitude: 49.4243, longitude: 20.9543 },  // initial drop, bearing west
      { latitude: 49.4237, longitude: 20.9539 },  // sweeping left turn
      { latitude: 49.4230, longitude: 20.9535 },  // wide arc through meadow
      { latitude: 49.4224, longitude: 20.9538 },  // berm right
      { latitude: 49.4218, longitude: 20.9542 },  // traverse east
      { latitude: 49.4212, longitude: 20.9540 },  // gentle descent
      { latitude: 49.4205, longitude: 20.9536 },  // table section
      { latitude: 49.4198, longitude: 20.9538 },  // roller segment
      { latitude: 49.4190, longitude: 20.9542 },  // berm sequence
      { latitude: 49.4182, longitude: 20.9545 },  // mid-section flow
      { latitude: 49.4174, longitude: 20.9543 },  // gentle S-turn
      { latitude: 49.4166, longitude: 20.9546 },  // lower meadow
      { latitude: 49.4158, longitude: 20.9548 },  // approach berms
      { latitude: 49.4150, longitude: 20.9550 },  // final flow section
      { latitude: 49.4142, longitude: 20.9553 },  // run-out
      { latitude: 49.4132, longitude: 20.9555 },  // finish gate — base west
    ],
  },

  // ────────────────────────────────────────────────────────
  // 2. Dookoła Świata Zielona — 3100m, longest trail
  //    Wide sweeping traverses across the mountain
  //    Crosses under lift, longest descent
  // ────────────────────────────────────────────────────────
  {
    trailId: 'dookola-swiata-zielona',
    startZone: { latitude: 49.4246, longitude: 20.9558, radiusM: 30 },
    finishZone: { latitude: 49.4128, longitude: 20.9565, radiusM: 30 },
    polyline: [
      { latitude: 49.4246, longitude: 20.9558 },  // start gate — summit center-left
      { latitude: 49.4241, longitude: 20.9555 },  // initial bearing west
      { latitude: 49.4236, longitude: 20.9548 },  // long traverse west
      { latitude: 49.4231, longitude: 20.9542 },  // wide switchback
      { latitude: 49.4226, longitude: 20.9548 },  // traverse east
      { latitude: 49.4221, longitude: 20.9556 },  // cross under lift
      { latitude: 49.4216, longitude: 20.9564 },  // continue east traverse
      { latitude: 49.4211, longitude: 20.9570 },  // wide right arc
      { latitude: 49.4205, longitude: 20.9574 },  // east-side descent
      { latitude: 49.4199, longitude: 20.9570 },  // switch back west
      { latitude: 49.4193, longitude: 20.9563 },  // long traverse
      { latitude: 49.4187, longitude: 20.9558 },  // flow through trees
      { latitude: 49.4180, longitude: 20.9556 },  // mid-mountain
      { latitude: 49.4173, longitude: 20.9560 },  // gentle arc right
      { latitude: 49.4166, longitude: 20.9564 },  // lower traverse
      { latitude: 49.4158, longitude: 20.9566 },  // approach base
      { latitude: 49.4150, longitude: 20.9565 },  // final flow
      { latitude: 49.4142, longitude: 20.9564 },  // run-out meadow
      { latitude: 49.4135, longitude: 20.9565 },  // approach finish
      { latitude: 49.4128, longitude: 20.9565 },  // finish gate — base center
    ],
  },

  // ────────────────────────────────────────────────────────
  // 3. Kometa Niebieska — 2300m, rider's right
  //    Rhythmic berms and pumpy rollers
  //    East side of the mountain
  // ────────────────────────────────────────────────────────
  {
    trailId: 'kometa-niebieska',
    startZone: { latitude: 49.4245, longitude: 20.9588, radiusM: 30 },
    finishZone: { latitude: 49.4130, longitude: 20.9590, radiusM: 30 },
    polyline: [
      { latitude: 49.4245, longitude: 20.9588 },  // start gate — summit east
      { latitude: 49.4240, longitude: 20.9592 },  // drop-in east
      { latitude: 49.4234, longitude: 20.9595 },  // first berm sequence
      { latitude: 49.4228, longitude: 20.9593 },  // pump track section
      { latitude: 49.4222, longitude: 20.9590 },  // rhythm berms
      { latitude: 49.4216, longitude: 20.9592 },  // tables
      { latitude: 49.4210, longitude: 20.9595 },  // flow arc right
      { latitude: 49.4203, longitude: 20.9597 },  // east-side corridor
      { latitude: 49.4196, longitude: 20.9595 },  // berm left
      { latitude: 49.4189, longitude: 20.9592 },  // mid-section rollers
      { latitude: 49.4182, longitude: 20.9594 },  // pumpy section
      { latitude: 49.4174, longitude: 20.9596 },  // lower flow
      { latitude: 49.4166, longitude: 20.9594 },  // final berms
      { latitude: 49.4156, longitude: 20.9592 },  // approach finish
      { latitude: 49.4144, longitude: 20.9591 },  // run-out
      { latitude: 49.4130, longitude: 20.9590 },  // finish gate — base east
    ],
  },

  // ────────────────────────────────────────────────────────
  // 4. Dzida Czerwona — 1500m, steep and direct
  //    Most direct fall line, minimal switchbacks
  //    Center corridor, natural terrain
  // ────────────────────────────────────────────────────────
  {
    trailId: 'dzida-czerwona',
    startZone: { latitude: 49.4250, longitude: 20.9575, radiusM: 25 },
    finishZone: { latitude: 49.4135, longitude: 20.9578, radiusM: 25 },
    polyline: [
      { latitude: 49.4250, longitude: 20.9575 },  // start gate — summit center
      { latitude: 49.4244, longitude: 20.9576 },  // steep initial drop
      { latitude: 49.4237, longitude: 20.9574 },  // direct fall line
      { latitude: 49.4229, longitude: 20.9576 },  // rock garden
      { latitude: 49.4220, longitude: 20.9578 },  // steep chute
      { latitude: 49.4210, longitude: 20.9577 },  // root section
      { latitude: 49.4200, longitude: 20.9575 },  // gap jump area
      { latitude: 49.4190, longitude: 20.9576 },  // direct descent
      { latitude: 49.4178, longitude: 20.9578 },  // technical rocks
      { latitude: 49.4165, longitude: 20.9577 },  // final steep
      { latitude: 49.4150, longitude: 20.9578 },  // approach finish
      { latitude: 49.4135, longitude: 20.9578 },  // finish gate — base center
    ],
  },
];

export const getTrailGeo = (trailId: string) =>
  trailGeoSeeds.find((t) => t.trailId === trailId);
