/**
 * Map framing helpers. Pure — no React Native imports.
 */
export type Coordinate = { latitude: number; longitude: number };

export type MapRegion = Coordinate & { latitudeDelta: number; longitudeDelta: number };

/**
 * Region IV-A framed as a whole: from Corregidor in the west to the Quezon
 * towns in the east. Used until the pins have loaded, and when there are none.
 */
export const CALABARZON_REGION: MapRegion = {
  latitude: 14.15,
  longitude: 121.15,
  latitudeDelta: 1.35,
  longitudeDelta: 1.35,
};

/** A close view around one destination. */
export const FOCUS_DELTA = 0.08;

/** Extra space around the outermost pins, as a share of the span. */
const PADDING = 0.18;
const MIN_DELTA = 0.05;

/** The smallest region that shows every coordinate, with some breathing room. */
export function regionForCoordinates(points: readonly Coordinate[]): MapRegion {
  if (points.length === 0) return CALABARZON_REGION;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const { latitude, longitude } of points) {
    minLat = Math.min(minLat, latitude);
    maxLat = Math.max(maxLat, latitude);
    minLng = Math.min(minLng, longitude);
    maxLng = Math.max(maxLng, longitude);
  }

  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(MIN_DELTA, latSpan * (1 + PADDING * 2)),
    longitudeDelta: Math.max(MIN_DELTA, lngSpan * (1 + PADDING * 2)),
  };
}

export function focusRegion(point: Coordinate, delta = FOCUS_DELTA): MapRegion {
  return { ...point, latitudeDelta: delta, longitudeDelta: delta };
}

/** Whether both coordinates are present and plausible. */
export function hasCoordinates<T extends { latitude: number | null; longitude: number | null }>(
  value: T,
): value is T & Coordinate {
  return (
    typeof value.latitude === 'number' &&
    typeof value.longitude === 'number' &&
    Math.abs(value.latitude) <= 90 &&
    Math.abs(value.longitude) <= 180
  );
}
