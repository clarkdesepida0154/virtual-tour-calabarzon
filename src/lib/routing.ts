/**
 * Road routing for the Field Trip Planner (Run 8) — the public OSRM demo
 * server (router.project-osrm.org, OpenStreetMap data, no key). Pure: the
 * fetcher and the clock are injected, so every rule is unit-tested in Node.
 *
 * One request per plan covers every point in order (start? → stop 1 → … →
 * stop n). The answer gives the road-following geometry (GeoJSON) and the
 * real driving distance / duration per leg. ANY failure — offline, a
 * timeout, OSRM down, a bad answer — returns null, and the planner falls
 * back to the straight dashed line with its "approximate" figures. Never an
 * error state.
 *
 * Demo only: production would use the Google Routes API (keyed, SLA).
 */
import type { Coordinate } from '@/lib/mapRegion';

export const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';
/** The UI never waits longer than this for OSRM. */
export const ROUTE_TIMEOUT_MS = 6000;
/** Reorders within this window make one request. */
export const ROUTE_DEBOUNCE_MS = 700;
/** Stored / drawn geometry is thinned to at most this many points. */
export const MAX_ROUTE_POINTS = 400;

export type RouteLeg = { km: number; minutes: number };

export type RoadRoute = {
  /** Signature of the points the route was computed for (see routeKey). */
  key: string;
  /** Road-following line, in drawing order. */
  geometry: Coordinate[];
  /** One leg per consecutive pair of points. */
  legs: RouteLeg[];
  km: number;
  minutes: number;
  fetchedAt: string;
};

const fixed = (value: number) => Number(value.toFixed(5));

/** Stable signature of an ordered point list: "lat,lng;lat,lng" (5 decimals ≈ 1 m). */
export function routeKey(points: readonly Coordinate[]): string {
  return points.map((point) => `${fixed(point.latitude)},${fixed(point.longitude)}`).join(';');
}

/**
 * The OSRM route URL. OSRM takes LONGITUDE first: `<lng>,<lat>;<lng>,<lat>`.
 * Null for fewer than two points.
 */
export function buildOsrmUrl(points: readonly Coordinate[]): string | null {
  if (points.length < 2) return null;
  const path = points.map((point) => `${fixed(point.longitude)},${fixed(point.latitude)}`).join(';');
  return `${OSRM_BASE}/${path}?overview=full&geometries=geojson`;
}

/**
 * Keeps the first and last point and an even spread in between, so a long
 * route stays light in AsyncStorage and on the map.
 */
export function thinGeometry(points: readonly Coordinate[], max = MAX_ROUTE_POINTS): Coordinate[] {
  if (points.length <= max) return [...points];
  const step = (points.length - 1) / (max - 1);
  const result: Coordinate[] = [];
  for (let index = 0; index < max; index += 1) result.push(points[Math.round(index * step)]);
  return result;
}

/** GeoJSON LineString coordinates ([lng, lat] pairs) → map coordinates. Invalid pairs are dropped. */
export function decodeGeometry(coordinates: unknown): Coordinate[] {
  if (!Array.isArray(coordinates)) return [];
  const points: Coordinate[] = [];
  for (const pair of coordinates) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const [longitude, latitude] = pair as unknown[];
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) continue;
    if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) continue;
    points.push({ latitude: fixed(latitude), longitude: fixed(longitude) });
  }
  return points;
}

/** Minutes rounded to whole minutes (never below 1 for a real leg). */
const toMinutes = (seconds: number) => (seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0);

/**
 * Reads an OSRM /route answer. Null unless it is `code: "Ok"` with a route
 * whose legs match the points (points − 1) and whose geometry has ≥ 2 points.
 */
export function parseOsrmRoute(body: unknown, points: readonly Coordinate[], now: () => Date = () => new Date()): RoadRoute | null {
  if (!body || typeof body !== 'object') return null;
  const answer = body as { code?: unknown; routes?: unknown };
  if (answer.code !== 'Ok' || !Array.isArray(answer.routes) || answer.routes.length === 0) return null;
  const route = answer.routes[0] as { legs?: unknown; geometry?: { coordinates?: unknown }; distance?: unknown; duration?: unknown };
  if (!Array.isArray(route.legs) || route.legs.length !== points.length - 1) return null;
  const legs: RouteLeg[] = [];
  for (const leg of route.legs as { distance?: unknown; duration?: unknown }[]) {
    if (typeof leg?.distance !== 'number' || typeof leg?.duration !== 'number') return null;
    if (!Number.isFinite(leg.distance) || !Number.isFinite(leg.duration) || leg.distance < 0 || leg.duration < 0) return null;
    legs.push({ km: leg.distance / 1000, minutes: toMinutes(leg.duration) });
  }
  const geometry = thinGeometry(decodeGeometry(route.geometry?.coordinates));
  if (geometry.length < 2) return null;
  const meters = typeof route.distance === 'number' ? route.distance : legs.reduce((sum, leg) => sum + leg.km * 1000, 0);
  const seconds =
    typeof route.duration === 'number'
      ? route.duration
      : (route.legs as { duration: number }[]).reduce((sum, leg) => sum + leg.duration, 0);
  return {
    key: routeKey(points),
    geometry,
    legs,
    km: meters / 1000,
    minutes: toMinutes(seconds),
    fetchedAt: now().toISOString(),
  };
}

export type Fetcher = (url: string, init: { signal: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

/**
 * Fetches the road route for the points, in order. Never throws: any
 * failure (network, timeout, non-200, a malformed answer) resolves to null.
 */
export async function fetchRoadRoute(
  points: readonly Coordinate[],
  options: { fetcher: Fetcher; timeoutMs?: number; now?: () => Date },
): Promise<RoadRoute | null> {
  const url = buildOsrmUrl(points);
  if (!url) return null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, options.timeoutMs ?? ROUTE_TIMEOUT_MS);
  });
  const request = (async () => {
    try {
      const response = await options.fetcher(url, { signal: controller.signal });
      if (!response.ok) return null;
      return parseOsrmRoute(await response.json(), points, options.now);
    } catch {
      return null;
    }
  })();
  try {
    return await Promise.race([request, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** A cached route is reusable only for exactly the same ordered points. */
export function reusableRoute(cached: RoadRoute | null | undefined, points: readonly Coordinate[]): RoadRoute | null {
  if (!cached || points.length < 2) return null;
  return cached.key === routeKey(points) && cached.legs.length === points.length - 1 ? cached : null;
}

/** Validates a route read back from storage (older or foreign data → null). */
export function parseStoredRoute(value: unknown): RoadRoute | null {
  if (!value || typeof value !== 'object') return null;
  const route = value as Record<string, unknown>;
  if (typeof route.key !== 'string' || typeof route.fetchedAt !== 'string') return null;
  if (typeof route.km !== 'number' || typeof route.minutes !== 'number') return null;
  if (!Array.isArray(route.legs) || !Array.isArray(route.geometry)) return null;
  const legs = (route.legs as unknown[]).filter(
    (leg): leg is RouteLeg =>
      !!leg && typeof (leg as RouteLeg).km === 'number' && typeof (leg as RouteLeg).minutes === 'number',
  );
  const geometry = (route.geometry as unknown[]).filter(
    (point): point is Coordinate =>
      !!point && typeof (point as Coordinate).latitude === 'number' && typeof (point as Coordinate).longitude === 'number',
  );
  if (legs.length !== route.legs.length || geometry.length < 2) return null;
  return { key: route.key, geometry, legs, km: route.km, minutes: route.minutes, fetchedAt: route.fetchedAt };
}

/**
 * A small in-memory cache keyed by routeKey, so moving a stop up and back
 * down again never re-asks OSRM.
 */
export function createRouteMemo(limit = 20) {
  const entries = new Map<string, RoadRoute>();
  return {
    get(points: readonly Coordinate[]): RoadRoute | null {
      return entries.get(routeKey(points)) ?? null;
    },
    put(route: RoadRoute): void {
      entries.delete(route.key);
      entries.set(route.key, route);
      while (entries.size > limit) entries.delete(entries.keys().next().value as string);
    },
    get size() {
      return entries.size;
    },
  };
}
