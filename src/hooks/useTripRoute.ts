/**
 * The planner's road route (Run 8): asks OSRM once per ordered point list
 * (debounced, so a burst of reorders makes one request), reuses a cached
 * route for the same points (a saved plan's, or this session's memo), and
 * reports
 *   'idle'     — fewer than two points;
 *   'loading'  — waiting for OSRM (the map shows a subtle chip);
 *   'routed'   — a road route is available;
 *   'fallback' — offline / OSRM failed / timed out → straight dashed line.
 * It never surfaces an error: see src/lib/routing.ts.
 */
import { useEffect, useEffectEvent, useState } from 'react';

import type { Coordinate } from '@/lib/mapRegion';
import { ROUTE_DEBOUNCE_MS, createRouteMemo, fetchRoadRoute, reusableRoute, routeKey } from '@/lib/routing';
import type { RoadRoute } from '@/lib/routing';

export type TripRouteStatus = 'idle' | 'loading' | 'routed' | 'fallback';

/** Shared by every planner visit in this app session. */
const memo = createRouteMemo();

export function useTripRoute(
  points: Coordinate[],
  options: { offline: boolean; cached?: RoadRoute | null; onRouted?: (route: RoadRoute) => void },
): { status: TripRouteStatus; route: RoadRoute | null } {
  const key = routeKey(points);
  const [result, setResult] = useState<{ key: string; route: RoadRoute | null } | null>(null);

  const reused = reusableRoute(options.cached, points) ?? memo.get(points);
  const settled = result?.key === key ? result : null;
  const needsFetch = points.length >= 2 && !reused && !settled && !options.offline;

  const routed = useEffectEvent((route: RoadRoute) => options.onRouted?.(route));

  useEffect(() => {
    if (!needsFetch) return;
    let alive = true;
    const requested = points;
    const timer = setTimeout(() => {
      void fetchRoadRoute(requested, { fetcher: (url, init) => fetch(url, init) }).then((route) => {
        if (route) memo.put(route);
        if (!alive) return;
        setResult({ key: routeKey(requested), route });
        if (route) routed(route);
      });
    }, ROUTE_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // `key` captures every change of `points`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, needsFetch]);

  if (points.length < 2) return { status: 'idle', route: null };
  if (reused) return { status: 'routed', route: reused };
  if (settled) return settled.route ? { status: 'routed', route: settled.route } : { status: 'fallback', route: null };
  if (options.offline) return { status: 'fallback', route: null };
  return { status: 'loading', route: null };
}
