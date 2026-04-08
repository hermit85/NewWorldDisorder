import { Spot } from '../types';
import { slotwinySpot } from '../seed/slotwinyOfficial';

export const mockSpots: Spot[] = [
  {
    id: slotwinySpot.id,
    name: slotwinySpot.name,
    slug: slotwinySpot.slug,
    description: slotwinySpot.description,
    region: slotwinySpot.region,
    isOfficial: slotwinySpot.isOfficial,
    coverImage: slotwinySpot.coverImage,
    status: slotwinySpot.status,
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
    activeRidersToday: 0,
    trailCount: 4,
  },
];

export const getSpot = (id: string) => mockSpots.find((s) => s.id === id);
