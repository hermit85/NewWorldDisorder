import { Trail } from '../types';
import { slotwinyTrails } from '../seed/slotwinyOfficial';

export const mockTrails: Trail[] = slotwinyTrails.map((t) => ({
  id: t.id,
  spotId: 'slotwiny-arena',
  name: t.officialName,
  slug: t.id,
  description: t.officialDescription,
  difficulty: t.gameDifficulty,
  trailType: t.trailType,
  distanceM: t.distanceM,
  elevationDropM: t.elevationDropM,
  isOfficial: true,
  isActive: t.isActive,
  sortOrder: t.sortOrder,
}));

export const getTrail = (id: string) => mockTrails.find((t) => t.id === id);
export const getTrailsForSpot = (spotId: string) =>
  mockTrails.filter((t) => t.spotId === spotId);
