/// <reference types="node" />
/** Run 8 unit tests: OSRM road routing (URL, decode, fallback, cache) and in-app 360° panoramas. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  EMBED_STREETVIEW_BASE,
  PANORAMA_RADIUS_M,
  classifyEmbedProbe,
  embedKeyFromEnv,
  isCurated,
  panoramaEmbedUrl,
  panoramaHtml,
  showsPanoramaStep,
  validateCuration,
} from '../src/lib/panorama';
import {
  MAX_ROUTE_POINTS,
  buildOsrmUrl,
  createRouteMemo,
  decodeGeometry,
  fetchRoadRoute,
  parseOsrmRoute,
  parseStoredRoute,
  reusableRoute,
  routeKey,
  thinGeometry,
} from '../src/lib/routing';
import type { Fetcher } from '../src/lib/routing';
import { createPlanStore, parsePlans, TRIP_PLANS_KEY } from '../src/lib/tripPlans';

const LUCBAN = { latitude: 14.11485, longitude: 121.55369 };
const PILA = { latitude: 14.23378, longitude: 121.36444 };
const AGUINALDO = { latitude: 14.445, longitude: 120.9069 };
const NOW = () => new Date('2026-11-21T08:00:00.000Z');

/** A well-formed OSRM answer for the given points. */
function osrmAnswer(points: { latitude: number; longitude: number }[], legMeters: number[], legSeconds: number[]) {
  return {
    code: 'Ok',
    routes: [
      {
        distance: legMeters.reduce((a, b) => a + b, 0),
        duration: legSeconds.reduce((a, b) => a + b, 0),
        legs: legMeters.map((distance, index) => ({ distance, duration: legSeconds[index], steps: [], summary: '' })),
        geometry: {
          type: 'LineString',
          coordinates: points.flatMap((point, index) =>
            index === 0 ? [[point.longitude, point.latitude]] : [[point.longitude - 0.01, point.latitude + 0.01], [point.longitude, point.latitude]],
          ),
        },
      },
    ],
  };
}

const okFetcher = (body: unknown): Fetcher => async () => ({ ok: true, json: async () => body });

describe('OSRM route URL', () => {
  it('puts LONGITUDE first for every point, in trip order', () => {
    assert.equal(
      buildOsrmUrl([LUCBAN, PILA, AGUINALDO]),
      'https://router.project-osrm.org/route/v1/driving/121.55369,14.11485;121.36444,14.23378;120.9069,14.445?overview=full&geometries=geojson',
    );
  });
  it('needs at least two points', () => {
    assert.equal(buildOsrmUrl([]), null);
    assert.equal(buildOsrmUrl([LUCBAN]), null);
  });
  it('rounds to 5 decimals', () => {
    assert.match(buildOsrmUrl([{ latitude: 14.123456789, longitude: 121.987654321 }, PILA])!, /driving\/121\.98765,14\.12346;/);
  });
});

describe('route geometry decode', () => {
  it('turns GeoJSON [lng, lat] pairs into { latitude, longitude }', () => {
    assert.deepEqual(decodeGeometry([[121.5, 14.1], [121.4, 14.2]]), [
      { latitude: 14.1, longitude: 121.5 },
      { latitude: 14.2, longitude: 121.4 },
    ]);
  });
  it('drops malformed and out-of-range pairs; non-arrays → []', () => {
    assert.deepEqual(decodeGeometry([[121.5], ['a', 1], [200, 14], [121, 95], [121.1, 14.1]]), [{ latitude: 14.1, longitude: 121.1 }]);
    assert.deepEqual(decodeGeometry(null), []);
    assert.deepEqual(decodeGeometry('x'), []);
  });
  it('thins long lines but keeps both ends', () => {
    const line = Array.from({ length: 5000 }, (_, i) => ({ latitude: 14 + i / 1e4, longitude: 121 }));
    const thin = thinGeometry(line);
    assert.equal(thin.length, MAX_ROUTE_POINTS);
    assert.deepEqual(thin[0], line[0]);
    assert.deepEqual(thin.at(-1), line.at(-1));
    assert.equal(thinGeometry(line.slice(0, 10)).length, 10);
  });
});

describe('parseOsrmRoute', () => {
  const points = [LUCBAN, PILA, AGUINALDO];
  it('reads per-leg road distance (km) and duration (min) plus totals', () => {
    const route = parseOsrmRoute(osrmAnswer(points, [24500, 51757], [1800, 2812]), points, NOW)!;
    assert.deepEqual(route.legs, [
      { km: 24.5, minutes: 30 },
      { km: 51.757, minutes: 47 },
    ]);
    assert.equal(route.km, 76.257);
    assert.equal(route.minutes, 77);
    assert.equal(route.key, routeKey(points));
    assert.equal(route.fetchedAt, '2026-11-21T08:00:00.000Z');
    assert.deepEqual(route.geometry[0], { latitude: LUCBAN.latitude, longitude: LUCBAN.longitude });
    assert.equal(route.geometry.length, 5);
  });
  it('rejects non-Ok codes, missing routes, a leg count that does not match, and short geometry', () => {
    assert.equal(parseOsrmRoute({ code: 'NoRoute', routes: [] }, points), null);
    assert.equal(parseOsrmRoute({ code: 'Ok' }, points), null);
    assert.equal(parseOsrmRoute(osrmAnswer(points.slice(0, 2), [1000], [60]), points), null);
    const broken = osrmAnswer(points, [1, 2], [3, 4]);
    broken.routes[0].geometry.coordinates = [[121, 14]];
    assert.equal(parseOsrmRoute(broken, points), null);
    assert.equal(parseOsrmRoute(null, points), null);
    assert.equal(parseOsrmRoute('Ok', points), null);
  });
});

describe('fetchRoadRoute — fallback path', () => {
  const points = [LUCBAN, PILA];
  it('returns the route when OSRM answers', async () => {
    let asked = '';
    const fetcher: Fetcher = async (url) => ((asked = url), { ok: true, json: async () => osrmAnswer(points, [24500], [1800]) });
    const route = await fetchRoadRoute(points, { fetcher, now: NOW });
    assert.equal(route?.legs.length, 1);
    assert.equal(asked, buildOsrmUrl(points));
  });
  it('resolves null (never throws) on a network error, a non-200 or a bad body', async () => {
    assert.equal(await fetchRoadRoute(points, { fetcher: async () => Promise.reject(new TypeError('Network request failed')) }), null);
    assert.equal(await fetchRoadRoute(points, { fetcher: async () => ({ ok: false, json: async () => ({}) }) }), null);
    assert.equal(await fetchRoadRoute(points, { fetcher: okFetcher({ code: 'InvalidQuery' }) }), null);
    assert.equal(await fetchRoadRoute(points, { fetcher: async () => ({ ok: true, json: async () => Promise.reject(new SyntaxError('bad json')) }) }), null);
  });
  it('gives up after the timeout and aborts the request', async () => {
    let aborted = false;
    const hanging: Fetcher = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => {
          aborted = true;
          reject(new Error('aborted'));
        });
      });
    const started = Date.now();
    assert.equal(await fetchRoadRoute(points, { fetcher: hanging, timeoutMs: 50 }), null);
    assert.ok(Date.now() - started < 1000);
    assert.equal(aborted, true);
  });
  it('makes no request for fewer than two points', async () => {
    let called = false;
    assert.equal(await fetchRoadRoute([LUCBAN], { fetcher: async () => ((called = true), { ok: true, json: async () => ({}) }) }), null);
    assert.equal(called, false);
  });
});

describe('route cache reuse', () => {
  const points = [LUCBAN, PILA, AGUINALDO];
  const route = parseOsrmRoute(osrmAnswer(points, [24500, 51757], [1800, 2812]), points, NOW)!;
  it('reuses a cached route only for exactly the same ordered points', () => {
    assert.equal(reusableRoute(route, points), route);
    assert.equal(reusableRoute(route, [LUCBAN, AGUINALDO, PILA]), null);
    assert.equal(reusableRoute(route, points.slice(0, 2)), null);
    assert.equal(reusableRoute(null, points), null);
  });
  it('the memo answers a repeated order without a new request', () => {
    const memo = createRouteMemo(2);
    memo.put(route);
    assert.equal(memo.get(points), route);
    assert.equal(memo.get([PILA, LUCBAN]), null);
    memo.put({ ...route, key: 'a' });
    memo.put({ ...route, key: 'b' });
    assert.equal(memo.size, 2);
    assert.equal(memo.get(points), null, 'oldest entry evicted');
  });
  it('a saved plan keeps its route through AsyncStorage and drops a broken one', async () => {
    const data = new Map<string, string>();
    const store = createPlanStore({ getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => void data.set(k, v) }, NOW);
    const saved = await store.save({ name: 'Trip', stopIds: ['a', 'b', 'c'], fromLocation: false, route });
    const [loaded] = await store.list();
    assert.deepEqual(loaded.route, route);
    assert.equal(reusableRoute(loaded.route, points), loaded.route);

    await store.attachRoute(saved.id, null);
    assert.equal((await store.list())[0].route, null);
    await store.attachRoute(saved.id, route);
    assert.deepEqual((await store.list())[0].route, route);
    await store.attachRoute('missing', route); // no-op

    const raw = JSON.parse(data.get(TRIP_PLANS_KEY)!);
    raw[0].route = { key: 'x', geometry: 'nope' };
    assert.equal(parsePlans(JSON.stringify(raw))[0].route, null);
    delete raw[0].route; // a plan saved before Run 8
    assert.equal(parsePlans(JSON.stringify(raw))[0].route, null);
    assert.equal(parseStoredRoute({ ...route, legs: [{ km: 'x' }] }), null);
  });
});

describe('panorama embed URL', () => {
  it('builds the Maps Embed Street View URL with the key, location, radius 250 and fov 90', () => {
    assert.equal(
      panoramaEmbedUrl(AGUINALDO, 'EMBED_KEY_TEST'),
      `${EMBED_STREETVIEW_BASE}?key=EMBED_KEY_TEST&location=14.445,120.9069&radius=${PANORAMA_RADIUS_M}&fov=90`,
    );
    assert.equal(PANORAMA_RADIUS_M, 250);
    assert.match(panoramaEmbedUrl(AGUINALDO, 'k', { radius: 100 })!, /radius=100&/);
  });
  it('reads the key from EXPO_PUBLIC_MAPS_EMBED_KEY (trimmed); never the Android SDK key', () => {
    assert.equal(embedKeyFromEnv({ EXPO_PUBLIC_MAPS_EMBED_KEY: '  abc ', GOOGLE_MAPS_ANDROID_API_KEY: 'sdk' }), 'abc');
    assert.equal(embedKeyFromEnv({ GOOGLE_MAPS_ANDROID_API_KEY: 'sdk' }), '');
  });
  it('needs a key and coordinates', () => {
    assert.equal(panoramaEmbedUrl(AGUINALDO, ''), null);
    assert.equal(panoramaEmbedUrl({ latitude: null, longitude: 121 }, 'k'), null);
  });
  it('frames the embed in an iframe page (the Embed API refuses top-level loads), escaping attributes', () => {
    const html = panoramaHtml('https://x/?a=1&b="2"', '#1C1814', 'View <x>');
    assert.match(html, /<iframe src="https:\/\/x\/\?a=1&amp;b=&quot;2&quot;"/);
    assert.match(html, /title="View &lt;x>"/);
    assert.match(html, /background:#1C1814/);
  });
});

describe('360° step rule', () => {
  const online = { offline: false, key: 'k' };
  it('curated with a panorama → shown; curated without → hidden', () => {
    assert.equal(showsPanoramaStep({ ...AGUINALDO, has_panorama: true }, online), true);
    assert.equal(showsPanoramaStep({ ...AGUINALDO, has_panorama: false }, online), false);
  });
  it('not curated (added in the app) → shown optimistically', () => {
    assert.equal(showsPanoramaStep({ ...AGUINALDO, has_panorama: null }, online), true);
    assert.equal(showsPanoramaStep({ ...AGUINALDO }, online), true);
    assert.equal(isCurated({ has_panorama: null }), false);
    assert.equal(isCurated({ has_panorama: false }), true);
  });
  it('never offline, without coordinates or without a key', () => {
    assert.equal(showsPanoramaStep({ ...AGUINALDO, has_panorama: true }, { offline: true, key: 'k' }), false);
    assert.equal(showsPanoramaStep({ latitude: null, longitude: null, has_panorama: true }, online), false);
    assert.equal(showsPanoramaStep({ ...AGUINALDO, has_panorama: true }, { offline: false, key: '' }), false);
  });
});

describe('panorama curation output', () => {
  it('classifies a place card over imagery as a panorama, and the black no-imagery frame as none', () => {
    assert.equal(classifyEmbedProbe({ hasPlaceCard: true, darkRatio: 0.02, text: 'Aguinaldo Shrine\nView on Google Maps' }), true);
    assert.equal(classifyEmbedProbe({ hasPlaceCard: false, darkRatio: 0.97, text: 'Image may be subject to copyright' }), false);
    assert.equal(classifyEmbedProbe({ hasPlaceCard: true, darkRatio: 0.95, text: 'x' }), false);
    assert.equal(classifyEmbedProbe({ hasPlaceCard: true, darkRatio: null, text: 'x' }), true);
  });
  it('validates the row set against the dataset slugs', () => {
    const rows = [
      { slug: 'a', name: 'A', province: 'Cavite', has_panorama: true, place_label: 'A' },
      { slug: 'b', name: 'B', province: 'Laguna', has_panorama: false, place_label: null },
    ];
    assert.deepEqual(validateCuration(rows, ['a', 'b']), []);
    assert.deepEqual(validateCuration(rows, ['a', 'b', 'c']), ['missing c']);
    assert.ok(validateCuration([...rows, rows[0]], ['a', 'b']).includes('duplicate a'));
  });
  it('the dataset carries a boolean has_panorama for all 26 destinations', () => {
    const dataset = JSON.parse(readFileSync(new URL('../data/destinations-seed.json', import.meta.url), 'utf8'));
    assert.equal(dataset.destinations.length, 26);
    for (const destination of dataset.destinations) assert.equal(typeof destination.has_panorama, 'boolean', destination.slug);
    assert.ok(dataset.panorama_curation?.checked_on);
  });
});
