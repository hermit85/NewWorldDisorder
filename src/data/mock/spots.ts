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
    activeRidersToday: 14,
    trailCount: 4,
  },
];

export const getSpot = (id: string) => mockSpots.find((s) => s.id === id);
