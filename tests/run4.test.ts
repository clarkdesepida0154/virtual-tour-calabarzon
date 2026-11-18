/// <reference types="node" />
/**
 * Unit tests for the Run 4 features: Near me (distances), favorites,
 * offline cache, and the directions / share hand-offs.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { favoriteDestinations, findTransferConflicts, mergeFavoriteChanges } from '../src/lib/favorites';
import type { FavoriteChange } from '../src/lib/favorites';
import { distanceFrom, distanceKm, formatDistance, sortByDistance } from '../src/lib/geo';
import { CACHE_KEYS, createOfflineCache, filterSummaries, isOfflineError } from '../src/lib/offlineCache';
import type { DataSource, KeyValueStore } from '../src/lib/offlineCache';
import { buildShareContent, directionsUrl, oneLineSummary } from '../src/lib/outbound';
import type { DestinationSummary } from '../src/types/database';

// Reference points (coordinates as stored in the dataset / well known).
const MANILA = { latitude: 14.5995, longitude: 120.9842 };
const RIZAL_SHRINE = { latitude: 14.2133, longitude: 121.1667 }; // Calamba, Laguna
const KAWIT = { latitude: 14.4436, longitude: 120.9025 }; // Aguinaldo Shrine
const LUCBAN = { latitude: 14.1139, longitude: 121.5564 }; // Lucban, Quezon

function summary(id: string, name: string, at: { latitude: number; longitude: number } | null): DestinationSummary {
  return {
    id,
    name,
    municipality: `${name} town`,
    province: 'Laguna',
    category: 'Historical Site',
    cover_image_url: null,
    latitude: at?.latitude ?? null,
    longitude: at?.longitude ?? null,
  };
}

/** In-memory AsyncStorage stand-in. */
function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: async (key) => data.get(key) ?? null,
    setItem: async (key, value) => {
      data.set(key, value);
    },
  };
}

const offline = () => Promise.reject(new TypeError('Network request failed'));

// ---------------------------------------------------------------------------
// Near me
// ---------------------------------------------------------------------------

describe('distance (haversine)', () => {
  it('is zero for the same point and symmetric', () => {
    assert.equal(distanceKm(MANILA, MANILA), 0);
    assert.equal(distanceKm(MANILA, LUCBAN), distanceKm(LUCBAN, MANILA));
  });

  it('matches known straight-line distances within 1%', () => {
    // One degree of latitude ≈ 111.19 km on the mean-radius sphere.
    const oneDegree = distanceKm({ latitude: 14, longitude: 121 }, { latitude: 15, longitude: 121 });
    assert.ok(Math.abs(oneDegree - 111.19) < 0.5, `1° of latitude = ${oneDegree}`);
    // Manila → Calamba is about 47 km as the crow flies.
    const calamba = distanceKm(MANILA, RIZAL_SHRINE);
    assert.ok(calamba > 46 && calamba < 48.5, `Manila → Calamba = ${calamba}`);
  });

  it('returns null when either side has no usable coordinates', () => {
    assert.equal(distanceFrom(null, RIZAL_SHRINE), null);
    assert.equal(distanceFrom(MANILA, { latitude: null, longitude: 121 }), null);
    assert.equal(distanceFrom(MANILA, { latitude: 120, longitude: 121 }), null);
    assert.ok((distanceFrom(MANILA, RIZAL_SHRINE) ?? 0) > 0);
  });

  it('formats like "12.4 km away", with metres for short distances', () => {
    assert.equal(formatDistance(12.43), '12.4 km away');
    assert.equal(formatDistance(4.25), '4.3 km away');
    assert.equal(formatDistance(1), '1.0 km away');
    assert.equal(formatDistance(0.853), '850 m away');
    assert.equal(formatDistance(0.01), 'Under 50 m away');
    assert.equal(formatDistance(128.6), '129 km away');
    assert.equal(formatDistance(Number.NaN), '');
  });

  it('sorts nearest first, puts places without coordinates last, and does not mutate', () => {
    const items = [
      summary('c', 'Lucban', LUCBAN),
      summary('x', 'No coordinates', null),
      summary('a', 'Kawit', KAWIT),
      summary('b', 'Calamba', RIZAL_SHRINE),
    ];
    const before = items.map((item) => item.id).join();
    const sorted = sortByDistance(items, MANILA).map((item) => item.id);
    assert.deepEqual(sorted, ['a', 'b', 'c', 'x']);
    assert.equal(items.map((item) => item.id).join(), before);
    // From Lucban the order flips.
    assert.deepEqual(sortByDistance(items, LUCBAN).map((item) => item.id), ['c', 'b', 'a', 'x']);
  });
});

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

describe('favorites logic', () => {
  const server = [
    { destination_id: 'a', created_at: '2026-11-01T00:00:00Z' },
    { destination_id: 'b', created_at: '2026-11-03T00:00:00Z' },
  ];

  it('shows the server rows newest first when nothing is pending', () => {
    assert.deepEqual(
      mergeFavoriteChanges(server, null).map((row) => row.destination_id),
      ['b', 'a'],
    );
  });

  it('lays optimistic adds and removes over the server rows', () => {
    const changes = new Map<string, FavoriteChange>([
      ['a', { on: false, at: '2026-11-05T00:00:00Z' }],
      ['c', { on: true, at: '2026-11-04T00:00:00Z' }],
      ['b', { on: true, at: '2026-11-06T00:00:00Z' }], // already saved: kept once, server time wins
    ]);
    const merged = mergeFavoriteChanges(server, changes);
    assert.deepEqual(merged.map((row) => row.destination_id), ['c', 'b']);
    assert.equal(merged.find((row) => row.destination_id === 'b')?.created_at, '2026-11-03T00:00:00Z');
    assert.equal(server.length, 2, 'input not mutated');
  });

  it('lists favorited destinations newest first, skipping deleted ones and duplicates', () => {
    const catalogue = [summary('a', 'Alpha', null), summary('b', 'Beta', null)];
    const rows = [
      { destination_id: 'a', created_at: '2026-11-01T00:00:00Z' },
      { destination_id: 'gone', created_at: '2026-11-09T00:00:00Z' },
      { destination_id: 'b', created_at: '2026-11-02T00:00:00Z' },
      { destination_id: 'a', created_at: '2026-10-01T00:00:00Z' },
    ];
    assert.deepEqual(favoriteDestinations(catalogue, rows).map((item) => item.id), ['b', 'a']);
    assert.deepEqual(favoriteDestinations(catalogue, []), []);
  });

  it('finds the guest rows that would clash with the account during transfer', () => {
    const guest = [
      { id: 'g1', destination_id: 'a' },
      { id: 'g2', destination_id: 'b' },
      { id: 'g3', destination_id: 'c' },
    ];
    const account = [{ destination_id: 'b' }, { destination_id: 'z' }];
    assert.deepEqual(findTransferConflicts(guest, account).map((row) => row.id), ['g2']);
    assert.deepEqual(findTransferConflicts(guest, []), []);
  });
});

// ---------------------------------------------------------------------------
// Offline cache
// ---------------------------------------------------------------------------

describe('offline cache', () => {
  it('recognises "no connection" errors only', () => {
    assert.equal(isOfflineError(new TypeError('Network request failed')), true);
    assert.equal(isOfflineError({ message: 'TypeError: Failed to fetch' }), true);
    assert.equal(isOfflineError(new Error('duplicate key value violates unique constraint')), false);
  });

  it('saves each successful read and serves it when offline', async () => {
    const store = memoryStore();
    const sources: DataSource[] = [];
    const cache = createOfflineCache(store, { onSource: (source) => sources.push(source) });

    assert.deepEqual(await cache.load('list', async () => ['x', 'y']), ['x', 'y']);
    assert.equal(store.data.size, 1);
    assert.deepEqual(await cache.load<string[]>('list', offline), ['x', 'y']);
    assert.deepEqual(sources, ['network', 'cache']);
  });

  it('a newer successful read replaces the saved copy', async () => {
    const cache = createOfflineCache(memoryStore());
    await cache.load('k', async () => 1);
    await cache.load('k', async () => 2);
    assert.equal(await cache.load<number>('k', offline), 2);
  });

  it('rethrows when offline with nothing saved, and on non-network errors', async () => {
    const cache = createOfflineCache(memoryStore());
    await assert.rejects(cache.load('missing', offline), /Network request failed/);
    await cache.load('k', async () => 'saved');
    await assert.rejects(
      cache.load('k', () => Promise.reject(new Error('permission denied for table destinations'))),
      /permission denied/,
    );
  });

  it('treats a corrupt entry or a failing store as "nothing saved"', async () => {
    const store = memoryStore();
    store.data.set('vtour.cache.k', '{not json');
    const cache = createOfflineCache(store);
    await assert.rejects(cache.load('k', offline));

    const broken: KeyValueStore = {
      getItem: () => Promise.reject(new Error('disk full')),
      setItem: () => Promise.reject(new Error('disk full')),
    };
    const fragile = createOfflineCache(broken);
    assert.equal(await fragile.load('k', async () => 'still works'), 'still works');
    await assert.rejects(fragile.load('k', offline));
  });

  it('uses a custom fallback for derived queries (e.g. filtered Explore offline)', async () => {
    const cache = createOfflineCache(memoryStore());
    const catalogue = [summary('a', 'Rizal Shrine', null), summary('b', 'Pagsanjan Falls', null)];
    await cache.load(CACHE_KEYS.catalogue, async () => catalogue);
    const result = await cache.load(null, offline, async () => {
      const saved = await cache.read<DestinationSummary[]>(CACHE_KEYS.catalogue);
      return saved ? filterSummaries(saved, { search: 'falls' }) : null;
    });
    assert.deepEqual(result.map((item) => item.id), ['b']);
  });

  it('filters a saved list like the server: search on name or town, category, province, A–Z', () => {
    const list: DestinationSummary[] = [
      { ...summary('1', 'Taal Basilica', null), province: 'Batangas', category: 'Church & Religious', municipality: 'Taal' },
      { ...summary('2', 'Taal Volcano', null), province: 'Batangas', category: 'Natural Wonder', municipality: 'Talisay' },
      { ...summary('3', 'Antipolo Cathedral', null), province: 'Rizal', category: 'Church & Religious', municipality: 'Antipolo' },
    ];
    assert.deepEqual(filterSummaries(list, {}).map((item) => item.id), ['3', '1', '2']);
    assert.deepEqual(filterSummaries(list, { search: 'TAAL' }).map((item) => item.id), ['1', '2']);
    assert.deepEqual(filterSummaries(list, { search: 'talisay' }).map((item) => item.id), ['2']);
    assert.deepEqual(
      filterSummaries(list, { category: 'Church & Religious', province: 'Batangas' }).map((item) => item.id),
      ['1'],
    );
  });
});

// ---------------------------------------------------------------------------
// Directions and share
// ---------------------------------------------------------------------------

describe('directions and share hand-offs', () => {
  it('builds the Google Maps universal directions link from stored coordinates', () => {
    assert.equal(
      directionsUrl({ latitude: 14.2133, longitude: 121.1667 }),
      'https://www.google.com/maps/dir/?api=1&destination=14.2133,121.1667',
    );
    assert.equal(
      directionsUrl({ latitude: 14.123456789, longitude: 121.987654321 }),
      'https://www.google.com/maps/dir/?api=1&destination=14.123457,121.987654',
    );
    assert.equal(directionsUrl({ latitude: null, longitude: 121 }), null);
  });

  it('shares the name, a one-line description and "Town • Province"', () => {
    const content = buildShareContent({
      name: 'Rizal Shrine',
      description:
        'A reconstruction of the house where José Rizal was born in 1861. It is now a museum. Visitors can tour the garden.',
      municipality: 'Calamba',
      province: 'Laguna',
    });
    assert.equal(content.title, 'Rizal Shrine');
    assert.equal(
      content.message,
      'Rizal Shrine\nA reconstruction of the house where José Rizal was born in 1861.\nCalamba • Laguna',
    );
  });

  it('keeps the one-liner short and skips abbreviations such as "St."', () => {
    assert.equal(
      oneLineSummary('The church of St. James stands in Paete. It was rebuilt.'),
      'The church of St. James stands in Paete.',
    );
    const long = oneLineSummary('word '.repeat(80).trim(), 60);
    assert.ok(long.length <= 60 && long.endsWith('…'), long);
  });
});
