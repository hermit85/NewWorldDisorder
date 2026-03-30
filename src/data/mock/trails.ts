import { Trail } from '../types';
import { slotwinyTrails } from '../seed/slotwinyOfficial';
import { KASINA_CONFIG } from '../venues';

const slotwinyMockTrails: Trail[] = slotwinyTrails.map((t) => ({
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
  isActive: true,
  sortOrder: t.sortOrder,
}));

const kasinaMockTrails: Trail[] = KASINA_CONFIG.trails.map((t, i) => ({
  id: t.id,
  spotId: 'kasina-bike-park',
  name: t.name,
  slug: t.id,
  description: t.description ?? '',
  difficulty: t.difficulty,
  trailType: t.trailType,
  distanceM: t.distanceM,
  elevationDropM: t.elevationDropM,
  isOfficial: true,
  isActive: true,
  sortOrder: i + 1,
}));

export const mockTrails: Trail[] = [...slotwinyMockTrails, ...kasinaMockTrails];

export const getTrail = (id: string) => mockTrails.find((t) => t.id === id);
export const getTrailsForSpot = (spotId: string) =>
  mockTrails.filter((t) => t.spotId === spotId);
