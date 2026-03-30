// ═══════════════════════════════════════════════════════════
// Geo → SVG Coordinate Transform
//
// Converts latitude/longitude to SVG viewport coordinates.
// Used by ArenaMapCustom to render trail polylines as SVG paths.
//
// Multi-resort ready: pass a ResortMapConfig for different venues.
// ═══════════════════════════════════════════════════════════

import { Dimensions } from 'react-native';
import type { GeoBounds } from '@/data/venueConfig';

// ── Default config: Słotwiny Arena (fallback when no venue specified) ──
const SLOTWINY_BOUNDS: GeoBounds = {
  latMin: 49.4100,
  latMax: 49.4275,
  lngMin: 20.9460,
  lngMax: 20.9630,
};

export const SVG_WIDTH = 1000;
export const SVG_HEIGHT = 1100;
export const SVG_VIEWBOX = `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`;

// Stroke scale: SVG viewport units per screen point
const { width: SCREEN_W } = Dimensions.get('window');
export const STROKE_SCALE = SVG_WIDTH / SCREEN_W;

// ── Geo → SVG ──
export function geoToSvg(
  lat: number,
  lng: number,
  bounds = SLOTWINY_BOUNDS,
): { x: number; y: number } {
  const x = ((lng - bounds.lngMin) / (bounds.lngMax - bounds.lngMin)) * SVG_WIDTH;
  // Flip Y: higher latitude = smaller Y (top of screen)
  const y = ((bounds.latMax - lat) / (bounds.latMax - bounds.latMin)) * SVG_HEIGHT;
  return { x, y };
}

// ── Polyline → SVG path "d" attribute ──
export function polylineToPath(
  coords: { latitude: number; longitude: number }[],
  bounds = SLOTWINY_BOUNDS,
): string {
  return coords
    .map((c, i) => {
      const { x, y } = geoToSvg(c.latitude, c.longitude, bounds);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// ── Polygon → SVG points attribute ──
export function polygonToPoints(
  coords: { latitude: number; longitude: number }[],
  bounds = SLOTWINY_BOUNDS,
): string {
  return coords
    .map((c) => {
      const { x, y } = geoToSvg(c.latitude, c.longitude, bounds);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

// ── SVG coord → screen position (for label overlay) ──
// Accounts for preserveAspectRatio="xMidYMid meet" letterboxing
export function svgToScreen(
  svgX: number,
  svgY: number,
  containerWidth: number,
  containerHeight: number,
): { left: number; top: number } {
  const scaleX = containerWidth / SVG_WIDTH;
  const scaleY = containerHeight / SVG_HEIGHT;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (containerWidth - SVG_WIDTH * scale) / 2;
  const offsetY = (containerHeight - SVG_HEIGHT * scale) / 2;
  return {
    left: offsetX + svgX * scale,
    top: offsetY + svgY * scale,
  };
}
