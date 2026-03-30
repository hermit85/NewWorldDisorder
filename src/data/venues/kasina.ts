// ═══════════════════════════════════════════════════════════
// Kasina Bike Park — VenueConfig
//
// Source: kasinaski.pl official trail map + descriptions
// 4 trails: Blue Cooler, Red Anakonda, Red Dzika, Black DH Cup
// Chairlift: 6-person, ~1000m, summit 902m asl
//
// Polylines traced from official aerial photo trail map.
// Approximate — ready for replacement with GPX data.
// ═══════════════════════════════════════════════════════════

import type { VenueConfig, TrailGeo, TerrainZone, LiftLine } from '../venueConfig';

// ── Geo reference points ──
// Summit (chairlift top): ~49.7200, 20.1490
// Base (chairlift bottom / parking): ~49.7130, 20.1530
// Trails spread from summit westward and southward

const KASINA_CENTER = { latitude: 49.7165, longitude: 20.1510 };

const KASINA_BOUNDS = {
  latMin: 49.7100,
  latMax: 49.7225,
  lngMin: 20.1420,
  lngMax: 20.1580,
};

// ── Trail geometry ──

const kasinaTrailGeo: TrailGeo[] = [
  // ────────────────────────────────────────────────────────
  // 3. Blue Cooler — 4500m, blue, longest trail
  //    Map: starts summit, sweeps far west with wide S-curves,
  //    loops back east, finishes at base area.
  //    The widest trail on the map — big flowing arcs.
  // ────────────────────────────────────────────────────────
  {
    trailId: 'kasina-blue-cooler',
    startZone: { latitude: 49.7198, longitude: 20.1492, radiusM: 30 },
    finishZone: { latitude: 49.7132, longitude: 20.1528, radiusM: 25 },
    labelAnchor: { latitude: 49.7175, longitude: 20.1445 },
    polyline: [
      // Summit start
      { latitude: 49.7198, longitude: 20.1492 },
      { latitude: 49.7195, longitude: 20.1485 },
      // West sweep — big curves
      { latitude: 49.7190, longitude: 20.1472 },
      { latitude: 49.7185, longitude: 20.1458 },
      { latitude: 49.7180, longitude: 20.1442 },
      { latitude: 49.7175, longitude: 20.1435 },
      // First switchback west
      { latitude: 49.7170, longitude: 20.1430 },
      { latitude: 49.7165, longitude: 20.1435 },
      { latitude: 49.7160, longitude: 20.1445 },
      // Second sweep east
      { latitude: 49.7155, longitude: 20.1460 },
      { latitude: 49.7150, longitude: 20.1475 },
      // Third sweep west
      { latitude: 49.7148, longitude: 20.1465 },
      { latitude: 49.7145, longitude: 20.1450 },
      { latitude: 49.7142, longitude: 20.1440 },
      // Return east toward base
      { latitude: 49.7140, longitude: 20.1455 },
      { latitude: 49.7138, longitude: 20.1475 },
      { latitude: 49.7135, longitude: 20.1495 },
      { latitude: 49.7133, longitude: 20.1510 },
      // Base approach
      { latitude: 49.7132, longitude: 20.1520 },
      { latitude: 49.7132, longitude: 20.1528 },
    ],
  },

  // ────────────────────────────────────────────────────────
  // 1. Red Anakonda — 3000m, red, machine-built advanced
  //    Map: starts summit, runs left side with switchbacks,
  //    wide bermed turns, no obstacle bypasses.
  // ────────────────────────────────────────────────────────
  {
    trailId: 'kasina-red-anakonda',
    startZone: { latitude: 49.7200, longitude: 20.1494, radiusM: 28 },
    finishZone: { latitude: 49.7133, longitude: 20.1532, radiusM: 25 },
    labelAnchor: { latitude: 49.7172, longitude: 20.1462 },
    polyline: [
      // Summit start (slightly east of Cooler)
      { latitude: 49.7200, longitude: 20.1494 },
      { latitude: 49.7196, longitude: 20.1490 },
      // West descent
      { latitude: 49.7192, longitude: 20.1480 },
      { latitude: 49.7188, longitude: 20.1470 },
      { latitude: 49.7183, longitude: 20.1462 },
      // First switchback
      { latitude: 49.7178, longitude: 20.1458 },
      { latitude: 49.7174, longitude: 20.1465 },
      { latitude: 49.7170, longitude: 20.1475 },
      // Second switchback
      { latitude: 49.7166, longitude: 20.1468 },
      { latitude: 49.7162, longitude: 20.1460 },
      { latitude: 49.7158, longitude: 20.1470 },
      // Mid-section flowing
      { latitude: 49.7154, longitude: 20.1480 },
      { latitude: 49.7150, longitude: 20.1490 },
      { latitude: 49.7146, longitude: 20.1498 },
      // Lower section
      { latitude: 49.7142, longitude: 20.1505 },
      { latitude: 49.7138, longitude: 20.1515 },
      { latitude: 49.7135, longitude: 20.1525 },
      // Base
      { latitude: 49.7133, longitude: 20.1532 },
    ],
  },

  // ────────────────────────────────────────────────────────
  // 4. Red Dzika — 1840m, black/red, natural hand-built
  //    Map: runs center-right, steeper, technical with roots
  //    and drops, multiple line variants.
  // ────────────────────────────────────────────────────────
  {
    trailId: 'kasina-red-dzika',
    startZone: { latitude: 49.7199, longitude: 20.1500, radiusM: 25 },
    finishZone: { latitude: 49.7134, longitude: 20.1535, radiusM: 25 },
    labelAnchor: { latitude: 49.7160, longitude: 20.1505 },
    polyline: [
      // Summit start (center)
      { latitude: 49.7199, longitude: 20.1500 },
      { latitude: 49.7195, longitude: 20.1502 },
      // Direct descent center
      { latitude: 49.7190, longitude: 20.1505 },
      { latitude: 49.7185, longitude: 20.1508 },
      { latitude: 49.7180, longitude: 20.1510 },
      // Technical section with slight curves
      { latitude: 49.7175, longitude: 20.1512 },
      { latitude: 49.7170, longitude: 20.1515 },
      { latitude: 49.7165, longitude: 20.1513 },
      { latitude: 49.7160, longitude: 20.1516 },
      // Mid section
      { latitude: 49.7155, longitude: 20.1520 },
      { latitude: 49.7150, longitude: 20.1522 },
      { latitude: 49.7145, longitude: 20.1525 },
      // Lower direct
      { latitude: 49.7140, longitude: 20.1530 },
      { latitude: 49.7137, longitude: 20.1533 },
      { latitude: 49.7134, longitude: 20.1535 },
    ],
  },

  // ────────────────────────────────────────────────────────
  // 2. Black DH Cup — 1740m, black, expert DH course
  //    Map: most direct line, stays center, DH competition course
  //    Gaps, drops, roots, rocks. Polish DH Cup venue.
  // ────────────────────────────────────────────────────────
  {
    trailId: 'kasina-black-dh-cup',
    startZone: { latitude: 49.7201, longitude: 20.1497, radiusM: 25 },
    finishZone: { latitude: 49.7131, longitude: 20.1538, radiusM: 25 },
    labelAnchor: { latitude: 49.7178, longitude: 20.1540 },
    polyline: [
      // Summit start (east of center)
      { latitude: 49.7201, longitude: 20.1497 },
      { latitude: 49.7197, longitude: 20.1500 },
      // Direct aggressive line
      { latitude: 49.7192, longitude: 20.1505 },
      { latitude: 49.7187, longitude: 20.1510 },
      { latitude: 49.7182, longitude: 20.1515 },
      { latitude: 49.7177, longitude: 20.1520 },
      // Center section — steep
      { latitude: 49.7172, longitude: 20.1525 },
      { latitude: 49.7167, longitude: 20.1528 },
      { latitude: 49.7162, longitude: 20.1530 },
      // Lower direct
      { latitude: 49.7155, longitude: 20.1532 },
      { latitude: 49.7148, longitude: 20.1534 },
      { latitude: 49.7140, longitude: 20.1536 },
      { latitude: 49.7135, longitude: 20.1537 },
      { latitude: 49.7131, longitude: 20.1538 },
    ],
  },
];

// ── Terrain zones (approximate from aerial photo) ──

const kasinaTerrainZones: TerrainZone[] = [
  {
    id: 'kasina-summit',
    type: 'summit',
    polygon: [
      { latitude: 49.7205, longitude: 20.1480 },
      { latitude: 49.7205, longitude: 20.1510 },
      { latitude: 49.7195, longitude: 20.1515 },
      { latitude: 49.7195, longitude: 20.1478 },
    ],
  },
  {
    id: 'kasina-forest-west',
    type: 'forest',
    polygon: [
      { latitude: 49.7195, longitude: 20.1425 },
      { latitude: 49.7195, longitude: 20.1475 },
      { latitude: 49.7140, longitude: 20.1470 },
      { latitude: 49.7135, longitude: 20.1430 },
    ],
  },
  {
    id: 'kasina-forest-center',
    type: 'forest',
    polygon: [
      { latitude: 49.7195, longitude: 20.1480 },
      { latitude: 49.7195, longitude: 20.1535 },
      { latitude: 49.7145, longitude: 20.1540 },
      { latitude: 49.7140, longitude: 20.1475 },
    ],
  },
  {
    id: 'kasina-base',
    type: 'base',
    polygon: [
      { latitude: 49.7140, longitude: 20.1505 },
      { latitude: 49.7140, longitude: 20.1555 },
      { latitude: 49.7125, longitude: 20.1555 },
      { latitude: 49.7125, longitude: 20.1505 },
    ],
  },
];

// ── Lift line ──

const kasinaLiftLine: LiftLine = {
  bottom: { latitude: 49.7130, longitude: 20.1535 },
  top: { latitude: 49.7200, longitude: 20.1495 },
  label: 'KOLEJ 6-OS',
};

// ═══════════════════════════════════════════════════════════
// VENUE CONFIG
// ═══════════════════════════════════════════════════════════

export const KASINA_CONFIG: VenueConfig = {
  id: 'kasina-bike-park',
  name: 'Kasina Bike Park',
  region: 'Kasina Wielka',
  operator: 'Kasina Ski & Bike Park',
  season: { id: 'season-01', name: 'Season 01', label: 'SEASON 01' },

  // Readiness — training validation mode until polylines confirmed by field GPS
  rankingEnabled: false,
  rankingDisabledReason: 'Walidacja treningowa — trasy w trakcie weryfikacji GPS',

  center: KASINA_CENTER,
  bounds: KASINA_BOUNDS,
  geofenceRadiusM: 1200,
  elevationM: 902,

  mapRegion: {
    ...KASINA_CENTER,
    latitudeDelta: 0.014,
    longitudeDelta: 0.016,
  },

  trails: [
    {
      id: 'kasina-blue-cooler',
      name: 'Blue Cooler',
      difficulty: 'easy',
      trailType: 'flow',
      distanceM: 4500,
      elevationDropM: 280,
      colorClass: 'blue',
      description: 'Longest trail. Machine-built flow with berms, tables, rollers. S and M obstacles.',
    },
    {
      id: 'kasina-red-anakonda',
      name: 'Red Anakonda',
      difficulty: 'medium',
      trailType: 'flow',
      distanceM: 3000,
      elevationDropM: 260,
      colorClass: 'red',
      description: 'Machine-built advanced. Wide berms, step downs, step ups. No bypasses.',
    },
    {
      id: 'kasina-red-dzika',
      name: 'Red Dzika',
      difficulty: 'hard',
      trailType: 'tech',
      distanceM: 1840,
      elevationDropM: 250,
      colorClass: 'red',
      description: 'Natural hand-built. Drops, gaps, roots. Multiple line variants. Fast and steep.',
    },
    {
      id: 'kasina-black-dh-cup',
      name: 'Black DH Cup',
      difficulty: 'hard',
      trailType: 'tech',
      distanceM: 1740,
      elevationDropM: 260,
      colorClass: 'black',
      description: 'Expert DH competition course. Gaps, drops, rocks, roots. Polish Cup venue.',
    },
  ],

  trailGeo: kasinaTrailGeo,
  terrainZones: kasinaTerrainZones,
  liftLines: [kasinaLiftLine],
};
