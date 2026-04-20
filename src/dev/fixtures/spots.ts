// Dev-only fixtures for unit tests + dev playground.
// NOT imported in production paths — safe to modify freely.
// These entries are synthetic test inputs, not real seed data.

import { Spot } from '@/data/types';

export const mockSpots: Spot[] = [
  {
    id: 'slotwiny-arena',
    name: 'Słotwiny Arena',
    slug: 'slotwiny-arena',
    description: 'Season 01 — Krynica-Zdrój. Four race trails from flow to full send.',
    region: 'Krynica-Zdrój',
    isOfficial: true,
    coverImage: '',
    status: 'active',
    submissionStatus: 'active',
    activeRidersToday: 0,
    trailCount: 4,
  },
  {
    id: 'kasina-bike-park',
    name: 'Kasina Bike Park',
    slug: 'kasina-bike-park',
    description: 'Season 01 — Kasina Wielka. Bike Park on Śnieżnica. Four trails from flow to DH Cup.',
    region: 'Kasina Wielka',
    isOfficial: true,
    coverImage: '',
    status: 'active',
    submissionStatus: 'active',
    activeRidersToday: 0,
    trailCount: 4,
  },
];

export const getSpot = (id: string) => mockSpots.find((s) => s.id === id);
