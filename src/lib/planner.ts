/**
 * Field Trip Planner (Run 6) — ordering, distances, the time estimate and
 * the Google Maps hand-off URL. Pure — no React Native imports — so every
 * rule here is unit-tested in Node. Saved plans live in ./tripPlans.ts.
 *
 * Distances are straight-line (haversine, ./geo.ts) and the time is a rough
 * driving estimate; the UI labels both as approximate.
 */
import { distanceKm } from '@/lib/geo';
import type { Coordinate } from '@/lib/mapRegion';

/**
 * Most stops a plan may have. Google Maps' URL hand-off takes an origin, a
 * destination and a limited number of waypoints (fewer on mobile), so the
 * planner caps a trip at 8 stops and the counter says so.
 */
export const MAX_STOPS = 8;

/** Winding provincial roads: road distance ≈ straight line × this factor. */
export const ROAD_FACTOR = 1.35;
/** Average driving speed for the estimate, km/h (towns, traffic, mountain roads). */
export const AVERAGE_SPEED_KMH = 35;

export type Stop = Coordinate & { id: string; name: string };

/**
 * Nearest-neighbour ordering: from `start` (the person's location) — or,
 * without one, from the first selected stop — always go to the closest stop
 * not visited yet. A greedy heuristic: quick, predictable and good enough
 * for ≤ 8 stops; the UI calls it "Suggested order" and allows manual edits.
 * Ties keep the selection order. Returns a new array.
 */
export function orderNearestNeighbor<T extends Coordinate>(stops: readonly T[], start?: Coordinate | null): T[] {
  if (stops.length <= 1) return [...stops];
  const remaining = [...stops];
  const ordered: T[] = [];
  let current: Coordinate;
  if (start) {
    current = start;
  } else {
    const first = remaining.shift()!;
    ordered.push(first);
    current = first;
  }
  while (remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    remaining.forEach((stop, index) => {
      const km = distanceKm(current, stop);
      if (km < bestDistance) {
        bestDistance = km;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    ordered.push(next);
    current = next;
  }
  return ordered;
}

export type Leg = { fromId: string | null; toId: string; km: number };

/** One leg per stop: from the start (if any) to stop 1, then stop to stop. */
export function legsFor(stops: readonly Stop[], start?: Coordinate | null): Leg[] {
  const legs: Leg[] = [];
  stops.forEach((stop, index) => {
    if (index === 0) {
      if (start) legs.push({ fromId: null, toId: stop.id, km: distanceKm(start, stop) });
      return;
    }
    const previous = stops[index - 1];
    legs.push({ fromId: previous.id, toId: stop.id, km: distanceKm(previous, stop) });
  });
  return legs;
}

export function totalKm(legs: readonly Leg[]): number {
  return legs.reduce((sum, leg) => sum + leg.km, 0);
}

/** Rough driving time in minutes for a straight-line distance (rounded to 5 minutes). */
export function estimateDriveMinutes(straightLineKm: number): number {
  if (!Number.isFinite(straightLineKm) || straightLineKm <= 0) return 0;
  const minutes = ((straightLineKm * ROAD_FACTOR) / AVERAGE_SPEED_KMH) * 60;
  return Math.max(5, Math.round(minutes / 5) * 5);
}

/** { hours, minutes } of a minute count, for "2 h 15 min". */
export function splitMinutes(total: number): { hours: number; minutes: number } {
  const safe = Math.max(0, Math.round(total));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
}

const point = (place: Coordinate) => `${Number(place.latitude.toFixed(6))},${Number(place.longitude.toFixed(6))}`;

/**
 * The Google Maps directions URL (no API key): origin → waypoints →
 * destination, by car. With a `start` (the person's location) every stop is
 * after it; without one the first stop is the origin. Stops beyond
 * `MAX_STOPS` are dropped. The waypoint separator `|` is percent-encoded.
 * Returns null when there is nothing to route (no stops, or only one stop
 * and no start).
 */
export function buildDirectionsUrl(stops: readonly Coordinate[], start?: Coordinate | null): string | null {
  const capped = stops.slice(0, MAX_STOPS);
  if (capped.length === 0 || (!start && capped.length < 2)) return null;
  const origin = start ?? capped[0];
  const rest = start ? capped : capped.slice(1);
  const destination = rest[rest.length - 1];
  const waypoints = rest.slice(0, -1);
  const params = [
    'api=1',
    `origin=${encodeURIComponent(point(origin))}`,
    `destination=${encodeURIComponent(point(destination))}`,
  ];
  if (waypoints.length > 0) params.push(`waypoints=${encodeURIComponent(waypoints.map(point).join('|'))}`);
  params.push('travelmode=driving');
  return `https://www.google.com/maps/dir/?${params.join('&')}`;
}

/** Moves the item at `index` one place up (-1) or down (+1). Out of range → unchanged copy. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const result = [...items];
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return result;
  [result[index], result[target]] = [result[target], result[index]];
  return result;
}

/** Adds or removes an id from a selection, never beyond `max`. */
export function toggleSelection(selected: readonly string[], id: string, max = MAX_STOPS): string[] {
  if (selected.includes(id)) return selected.filter((item) => item !== id);
  if (selected.length >= max) return [...selected];
  return [...selected, id];
}
