/**
 * Distances between the learner and the destinations ("Near me").
 *
 * Everything is computed on the phone with the haversine formula — no
 * geocoding or routing API is called. Pure, no React Native imports, so the
 * unit tests run it in Node.
 */
import { hasCoordinates } from '@/lib/mapRegion';
import type { Coordinate } from '@/lib/mapRegion';

/** Mean Earth radius (IUGG), in kilometres. */
const EARTH_RADIUS_KM = 6371.0088;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle ("as the crow flies") distance between two points, in km. */
export function distanceKm(from: Coordinate, to: Coordinate): number {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLng = toRadians(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

type MaybePlaced = { latitude: number | null; longitude: number | null };

/** Distance from `origin` to a place, or `null` when either side has no usable coordinates. */
export function distanceFrom(origin: Coordinate | null | undefined, place: MaybePlaced): number | null {
  if (!origin || !hasCoordinates(origin) || !hasCoordinates(place)) return null;
  return distanceKm(origin, place);
}

/**
 * The distance itself, language-neutral: "850 m", "4.2 km", "128 km".
 * Metres are rounded to the nearest 10. Returns `'under-50'` for very short
 * distances and `null` for an invalid value; the UI words it
 * (`useI18n().distance`).
 */
export function formatDistanceValue(km: number): string | 'under-50' | null {
  if (!Number.isFinite(km) || km < 0) return null;
  if (km < 0.05) return 'under-50';
  if (km < 1) return `${Math.round((km * 1000) / 10) * 10} m`;
  if (km < 100) return `${(Math.round(km * 10) / 10).toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** English wording: "850 m away", "12.4 km away", "Under 50 m away" (scripts, tests). */
export function formatDistance(km: number): string {
  const value = formatDistanceValue(km);
  if (value === null) return '';
  return value === 'under-50' ? 'Under 50 m away' : `${value} away`;
}

/**
 * The items ordered nearest first. Items without coordinates go last (A–Z);
 * ties keep A–Z order. Returns a new array; the input is not changed.
 */
export function sortByDistance<T extends MaybePlaced & { name: string }>(
  items: readonly T[],
  origin: Coordinate,
): T[] {
  return items
    .map((item) => ({ item, km: distanceFrom(origin, item) }))
    .sort((a, b) => {
      if (a.km === null && b.km === null) return a.item.name.localeCompare(b.item.name);
      if (a.km === null) return 1;
      if (b.km === null) return -1;
      return a.km - b.km || a.item.name.localeCompare(b.item.name);
    })
    .map(({ item }) => item);
}
