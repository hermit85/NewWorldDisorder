// ═══════════════════════════════════════════════════════════
// SEED: Słotwiny Arena — Map geometry & zones
// Manual trace from official Grupa Pingwina trail map photo
//
// Key layout facts from official map:
// - Summit at top (north), base at bottom (south)
// - Trails spread WIDE laterally, not just vertical corridors
// - Trail 1 (Gałgan) sweeps through center with big S-curves
// - Trail 2 (Dookoła Świata) is the widest outer loop, goes far west
// - Trail 3 (Dzida) is the most direct, stays east
// - Trail 4 (Kometa) runs center-left with flowing curves
// - Lift line runs roughly center
//
// Ready for replacement with real GPX/GeoJSON data.
// ═══════════════════════════════════════════════════════════

export interface TrailGeoSeed {
  trailId: string;
  startZone: { latitude: number; longitude: number; radiusM: number };
  finishZone: { latitude: number; longitude: number; radiusM: number };
  polyline: { latitude: number; longitude: number }[];
  /** Dedicated position for the trail name label, avoids overlap */
  labelAnchor?: { latitude: number; longitude: number };
}

// Center of Słotwiny Arena — between summit and base
export const SLOTWINY_CENTER = {
  latitude: 49.4190,
  longitude: 20.9560,
};

export const SLOTWINY_REGION = {
  ...SLOTWINY_CENTER,
  latitudeDelta: 0.018,
  longitudeDelta: 0.016,
};

// Lift line reference (kolej linowa 6-osobowa)
export const LIFT_LINE = {
  bottom: { latitude: 49.4130, longitude: 20.9570 },
  top: { latitude: 49.4248, longitude: 20.9572 },
};

export const trailGeoSeeds: TrailGeoSeed[] = [
  // ────────────────────────────────────────────────────────
  // 1. Gałgan Niebieska — 2400m, 7.5%, blue flow
  //    Official map: starts summit center, sweeps west in big
  //    S-curves through open meadow, returns east to base.
  //    The most visually prominent trail on the map — wide arcs.
  // ────────────────────────────────────────────────────────
  {
    trailId: 'galgan-niebieska',
    startZone: { latitude: 49.4248, longitude: 20.9565, radiusM: 30 },
    finishZone: { latitude: 49.4130, longitude: 20.9580, radiusM: 30 },
    labelAnchor: { latitude: 49.4210, longitude: 20.9530 },
    polyline: [
      { latitude: 49.4248, longitude: 20.9565 },  // START — summit, center
      { latitude: 49.4244, longitude: 20.9558 },  // initial drop, bearing west
      { latitude: 49.4240, longitude: 20.9548 },  // sweeping left arc
      { latitude: 49.4234, longitude: 20.9535 },  // wide traverse west into meadow
      { latitude: 49.4228, longitude: 20.9525 },  // furthest west point
      { latitude: 49.4222, longitude: 20.9530 },  // arc back east
      { latitude: 49.4216, longitude: 20.9542 },  // traverse east through berms
      { latitude: 49.4210, longitude: 20.9552 },  // cross back toward center
      { latitude: 49.4204, longitude: 20.9558 },  // S-turn mid-mountain
      { latitude: 49.4198, longitude: 20.9548 },  // sweep west again
      { latitude: 49.4192, longitude: 20.9535 },  // wide arc through lower meadow
      { latitude: 49.4186, longitude: 20.9530 },  // westward section
      { latitude: 49.4180, longitude: 20.9538 },  // curve back east
      { latitude: 49.4174, longitude: 20.9550 },  // flow through trees
      { latitude: 49.4168, longitude: 20.9560 },  // approach base area
      { latitude: 49.4160, longitude: 20.9568 },  // lower berms
      { latitude: 49.4152, longitude: 20.9574 },  // final traverse east
      { latitude: 49.4142, longitude: 20.9578 },  // run-out
      { latitude: 49.4130, longitude: 20.9580 },  // FINISH — base, center-east
    ],
  },

  // ────────────────────────────────────────────────────────
  // 2. Dookoła Świata Zielona — 3100m, 5%, green flow
  //    Official map: the widest outer loop. Goes FAR west
  //    (leftmost trail on map). Longest trail, gentlest grade.
  //    Marker "2" on official map is at far left of mountain.
  // ────────────────────────────────────────────────────────
  {
    trailId: 'dookola-swiata-zielona',
    startZone: { latitude: 49.4246, longitude: 20.9558, radiusM: 30 },
    finishZone: { latitude: 49.4128, longitude: 20.9588, radiusM: 30 },
    labelAnchor: { latitude: 49.4185, longitude: 20.9498 },
    polyline: [
      { latitude: 49.4246, longitude: 20.9558 },  // START — summit, center-left
      { latitude: 49.4242, longitude: 20.9550 },  // initial traverse west
      { latitude: 49.4238, longitude: 20.9538 },  // heading far west
      { latitude: 49.4233, longitude: 20.9522 },  // long gentle traverse
      { latitude: 49.4228, longitude: 20.9508 },  // far west territory
      { latitude: 49.4222, longitude: 20.9498 },  // FURTHEST WEST — outer loop apex
      { latitude: 49.4215, longitude: 20.9495 },  // following western boundary
      { latitude: 49.4208, longitude: 20.9498 },  // gentle descent, still far west
      { latitude: 49.4200, longitude: 20.9505 },  // start curving back east
      { latitude: 49.4193, longitude: 20.9512 },  // traverse back
      { latitude: 49.4186, longitude: 20.9508 },  // lower west section
      { latitude: 49.4180, longitude: 20.9515 },  // wide arc
      { latitude: 49.4174, longitude: 20.9528 },  // long traverse east
      { latitude: 49.4168, longitude: 20.9545 },  // crossing toward center
      { latitude: 49.4162, longitude: 20.9558 },  // through lower trees
      { latitude: 49.4155, longitude: 20.9568 },  // approach base
      { latitude: 49.4148, longitude: 20.9575 },  // lower meadow
      { latitude: 49.4140, longitude: 20.9582 },  // run-out east
      { latitude: 49.4134, longitude: 20.9586 },  // approach finish
      { latitude: 49.4128, longitude: 20.9588 },  // FINISH — base, east
    ],
  },

  // ────────────────────────────────────────────────────────
  // 3. Kometa Niebieska — 2300m, 8%, blue flow
  //    Official map: runs center-left, between Gałgan and
  //    Dookoła Świata. Marker "4" on official map is left side.
  //    Rhythmic berms and flowing curves.
  // ────────────────────────────────────────────────────────
  {
    trailId: 'kometa-niebieska',
    startZone: { latitude: 49.4245, longitude: 20.9555, radiusM: 30 },
    finishZone: { latitude: 49.4130, longitude: 20.9572, radiusM: 30 },
    labelAnchor: { latitude: 49.4195, longitude: 20.9515 },
    polyline: [
      { latitude: 49.4245, longitude: 20.9555 },  // START — summit, left of center
      { latitude: 49.4240, longitude: 20.9545 },  // drop-in west
      { latitude: 49.4235, longitude: 20.9532 },  // traverse left
      { latitude: 49.4229, longitude: 20.9520 },  // wide arc west
      { latitude: 49.4223, longitude: 20.9515 },  // west corridor
      { latitude: 49.4217, longitude: 20.9518 },  // berm sequence
      { latitude: 49.4211, longitude: 20.9525 },  // flow arc right
      { latitude: 49.4205, longitude: 20.9520 },  // pump back left
      { latitude: 49.4199, longitude: 20.9528 },  // rhythm section
      { latitude: 49.4193, longitude: 20.9522 },  // berms
      { latitude: 49.4187, longitude: 20.9530 },  // mid-mountain flow
      { latitude: 49.4181, longitude: 20.9540 },  // traverse east
      { latitude: 49.4175, longitude: 20.9548 },  // lower curves
      { latitude: 49.4168, longitude: 20.9555 },  // approach base zone
      { latitude: 49.4158, longitude: 20.9562 },  // final flow
      { latitude: 49.4145, longitude: 20.9568 },  // run-out
      { latitude: 49.4130, longitude: 20.9572 },  // FINISH — base, center
    ],
  },

  // ────────────────────────────────────────────────────────
  // 4. Dzida Czerwona — 1500m, 11%, red tech
  //    Official map: starts summit east, MOST DIRECT steep
  //    descent. Marker "3" on official map is upper right.
  //    Stays on the east side, minimal lateral movement.
  //    Shortest trail, steepest gradient.
  // ────────────────────────────────────────────────────────
  {
    trailId: 'dzida-czerwona',
    startZone: { latitude: 49.4250, longitude: 20.9580, radiusM: 25 },
    finishZone: { latitude: 49.4138, longitude: 20.9595, radiusM: 25 },
    labelAnchor: { latitude: 49.4215, longitude: 20.9600 },
    polyline: [
      { latitude: 49.4250, longitude: 20.9580 },  // START — summit, east
      { latitude: 49.4244, longitude: 20.9585 },  // steep drop-in east
      { latitude: 49.4237, longitude: 20.9590 },  // direct descent
      { latitude: 49.4230, longitude: 20.9595 },  // rock garden
      { latitude: 49.4222, longitude: 20.9598 },  // steep chute, east corridor
      { latitude: 49.4214, longitude: 20.9600 },  // roots and rocks
      { latitude: 49.4205, longitude: 20.9598 },  // gap section
      { latitude: 49.4196, longitude: 20.9595 },  // technical descent
      { latitude: 49.4186, longitude: 20.9596 },  // lower steep
      { latitude: 49.4175, longitude: 20.9598 },  // final technical section
      { latitude: 49.4162, longitude: 20.9596 },  // approach finish
      { latitude: 49.4148, longitude: 20.9595 },  // run-out
      { latitude: 49.4138, longitude: 20.9595 },  // FINISH — base, east
    ],
  },
];

export const getTrailGeo = (trailId: string) =>
  trailGeoSeeds.find((t) => t.trailId === trailId);

// ═══════════════════════════════════════════════════════════
// TERRAIN ZONES — stylized polygon overlays for branded map
// These are presentation-only, not used for GPS logic.
// Approximate shapes based on the official trail map photo.
// ═══════════════════════════════════════════════════════════

export interface TerrainZone {
  id: string;
  type: 'forest' | 'openSlope' | 'summit' | 'base';
  polygon: { latitude: number; longitude: number }[];
}

export const terrainZones: TerrainZone[] = [
  // Summit ridge — organic blob around start gates
  {
    id: 'summit-ridge',
    type: 'summit',
    polygon: [
      { latitude: 49.4258, longitude: 20.9548 },
      { latitude: 49.4257, longitude: 20.9562 },
      { latitude: 49.4256, longitude: 20.9578 },
      { latitude: 49.4254, longitude: 20.9592 },
      { latitude: 49.4251, longitude: 20.9604 },
      { latitude: 49.4246, longitude: 20.9610 },
      { latitude: 49.4240, longitude: 20.9608 },
      { latitude: 49.4236, longitude: 20.9598 },
      { latitude: 49.4234, longitude: 20.9580 },
      { latitude: 49.4233, longitude: 20.9560 },
      { latitude: 49.4234, longitude: 20.9542 },
      { latitude: 49.4237, longitude: 20.9535 },
      { latitude: 49.4242, longitude: 20.9532 },
      { latitude: 49.4248, longitude: 20.9534 },
      { latitude: 49.4253, longitude: 20.9538 },
    ],
  },
  // West forest mass — organic treeline shape
  {
    id: 'west-forest',
    type: 'forest',
    polygon: [
      { latitude: 49.4234, longitude: 20.9488 },
      { latitude: 49.4236, longitude: 20.9505 },
      { latitude: 49.4234, longitude: 20.9522 },
      { latitude: 49.4228, longitude: 20.9534 },
      { latitude: 49.4220, longitude: 20.9538 },
      { latitude: 49.4210, longitude: 20.9540 },
      { latitude: 49.4198, longitude: 20.9536 },
      { latitude: 49.4188, longitude: 20.9528 },
      { latitude: 49.4178, longitude: 20.9525 },
      { latitude: 49.4168, longitude: 20.9530 },
      { latitude: 49.4158, longitude: 20.9540 },
      { latitude: 49.4148, longitude: 20.9548 },
      { latitude: 49.4140, longitude: 20.9545 },
      { latitude: 49.4135, longitude: 20.9530 },
      { latitude: 49.4132, longitude: 20.9510 },
      { latitude: 49.4134, longitude: 20.9492 },
      { latitude: 49.4140, longitude: 20.9482 },
      { latitude: 49.4155, longitude: 20.9478 },
      { latitude: 49.4172, longitude: 20.9476 },
      { latitude: 49.4190, longitude: 20.9478 },
      { latitude: 49.4208, longitude: 20.9480 },
      { latitude: 49.4222, longitude: 20.9482 },
    ],
  },
  // Central tree band — organic strip between trail corridors
  {
    id: 'central-trees',
    type: 'forest',
    polygon: [
      { latitude: 49.4228, longitude: 20.9556 },
      { latitude: 49.4225, longitude: 20.9565 },
      { latitude: 49.4218, longitude: 20.9572 },
      { latitude: 49.4210, longitude: 20.9578 },
      { latitude: 49.4200, longitude: 20.9580 },
      { latitude: 49.4190, longitude: 20.9575 },
      { latitude: 49.4180, longitude: 20.9568 },
      { latitude: 49.4172, longitude: 20.9570 },
      { latitude: 49.4165, longitude: 20.9568 },
      { latitude: 49.4165, longitude: 20.9558 },
      { latitude: 49.4172, longitude: 20.9552 },
      { latitude: 49.4182, longitude: 20.9550 },
      { latitude: 49.4192, longitude: 20.9548 },
      { latitude: 49.4202, longitude: 20.9550 },
      { latitude: 49.4212, longitude: 20.9548 },
      { latitude: 49.4222, longitude: 20.9550 },
    ],
  },
  // East forest — organic mass along Dzida corridor
  {
    id: 'east-forest',
    type: 'forest',
    polygon: [
      { latitude: 49.4238, longitude: 20.9602 },
      { latitude: 49.4240, longitude: 20.9612 },
      { latitude: 49.4238, longitude: 20.9622 },
      { latitude: 49.4225, longitude: 20.9625 },
      { latitude: 49.4210, longitude: 20.9618 },
      { latitude: 49.4195, longitude: 20.9614 },
      { latitude: 49.4178, longitude: 20.9612 },
      { latitude: 49.4162, longitude: 20.9608 },
      { latitude: 49.4148, longitude: 20.9605 },
      { latitude: 49.4135, longitude: 20.9608 },
      { latitude: 49.4128, longitude: 20.9600 },
      { latitude: 49.4130, longitude: 20.9590 },
      { latitude: 49.4142, longitude: 20.9592 },
      { latitude: 49.4158, longitude: 20.9594 },
      { latitude: 49.4175, longitude: 20.9598 },
      { latitude: 49.4192, longitude: 20.9600 },
      { latitude: 49.4208, longitude: 20.9598 },
      { latitude: 49.4224, longitude: 20.9596 },
      { latitude: 49.4234, longitude: 20.9598 },
    ],
  },
];
