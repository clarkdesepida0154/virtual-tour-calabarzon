/**
 * End-to-end check of the data layer against the LIVE Supabase project.
 *
 *   npm run db:test
 *
 * It imports the app's real repositories (src/repositories) and form logic,
 * and talks to Supabase exactly the way the app does: through the Data API
 * with the publishable key (the `anon` role). So a pass here means the RLS
 * policies, grants, storage policies and query code all work together.
 *
 * Every row and file it creates is removed again; seed data is untouched.
 * Run with tsx (see package.json) so the TypeScript sources can be imported.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { base64ToArrayBuffer } from '../src/lib/base64.ts';
import {
  EMPTY_FORM_VALUES,
  toDestinationInput,
  validateDestinationForm,
} from '../src/lib/destinationForm.ts';
import {
  createDestinationImagesRepository,
  storagePathFromPublicUrl,
} from '../src/repositories/destinationImages.ts';
import { buildSearchFilter, createDestinationsRepository } from '../src/repositories/destinations.ts';

const MARKER = '[verify-crud]';

// --- environment (EXPO_PUBLIC_* only — the same values the app ships with) ---
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing in .env');
  process.exit(1);
}

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const destinations = createDestinationsRepository(client);
const images = createDestinationImagesRepository(client);

// --- tiny test harness ---
let passed = 0;
const failures = [];

async function check(name, run) {
  try {
    await run();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const names = (rows) => rows.map((row) => row.name);

// --- checks ---
async function main() {
  console.log(`Verifying the data layer against ${url}\n`);
  let created = null;
  let uploadedUrl = null;

  console.log('Pure logic');
  await check('base64 decoder matches Node for every padding length', async () => {
    for (const size of [0, 1, 2, 3, 4, 5, 255, 1024, 70001]) {
      const source = Buffer.from(Array.from({ length: size }, (_, i) => (i * 31 + 7) % 256));
      const decoded = Buffer.from(base64ToArrayBuffer(source.toString('base64')));
      expect(decoded.equals(source), `mismatch at ${size} bytes`);
    }
    const viaDataUri = base64ToArrayBuffer(`data:image/jpeg;base64,${Buffer.from('hi').toString('base64')}`);
    expect(Buffer.from(viaDataUri).toString() === 'hi', 'data URI prefix not stripped');
  });

  await check('form validation: required fields and coordinates', async () => {
    const empty = validateDestinationForm(EMPTY_FORM_VALUES);
    for (const field of ['name', 'description', 'address', 'province', 'category']) {
      expect(empty[field], `expected an error for empty ${field}`);
    }
    const base = {
      ...EMPTY_FORM_VALUES,
      name: 'X',
      description: 'Y',
      address: 'Z',
      province: 'Laguna',
      category: 'Museum & Art',
    };
    expect(Object.keys(validateDestinationForm(base)).length === 0, 'valid form reported errors');
    expect(validateDestinationForm({ ...base, latitude: 'abc', longitude: '121' }).latitude, 'non-numeric latitude accepted');
    expect(validateDestinationForm({ ...base, latitude: '91', longitude: '121' }).latitude, 'latitude 91 accepted');
    expect(validateDestinationForm({ ...base, latitude: '14.2', longitude: '181' }).longitude, 'longitude 181 accepted');
    expect(validateDestinationForm({ ...base, latitude: '14.2' }).longitude, 'latitude without longitude accepted');
    const ok = validateDestinationForm({ ...base, latitude: ' 14,2136 ', longitude: '121.1669' });
    expect(Object.keys(ok).length === 0, 'valid coordinates rejected');
    const row = toDestinationInput({ ...base, municipality: '  ', latitude: '14,5', longitude: '121' }, null);
    expect(row.municipality === null && row.latitude === 14.5 && row.longitude === 121, 'conversion to row is wrong');
  });

  console.log('\nRead');
  let all = [];
  await check('list() returns the seed destinations, A–Z', async () => {
    all = await destinations.list();
    expect(all.length >= 6, `expected at least 6 rows, got ${all.length}`);
    const sorted = [...names(all)].sort((a, b) => a.localeCompare(b));
    expect(JSON.stringify(names(all)) === JSON.stringify(sorted), 'not sorted by name');
  });

  await check('getById() returns one row; unknown and malformed ids return null', async () => {
    const first = await destinations.getById(all[0].id);
    expect(first?.name === all[0].name, 'wrong row returned');
    expect((await destinations.getById('00000000-0000-0000-0000-000000000000')) === null, 'unknown id');
    expect((await destinations.getById('not-a-uuid')) === null, 'malformed id');
  });

  await check('listFeatured() respects its limit', async () => {
    const featured = await destinations.listFeatured(3);
    expect(featured.length === 3, `expected 3, got ${featured.length}`);
  });

  await check('counts() adds up per category and province', async () => {
    const counts = await destinations.counts();
    const sum = (record) => Object.values(record).reduce((a, b) => a + b, 0);
    expect(counts.total === all.length, 'total mismatch');
    expect(sum(counts.byCategory) === counts.total, 'category counts do not add up');
    expect(sum(counts.byProvince) === counts.total, 'province counts do not add up');
    expect(counts.byProvince.Laguna >= 2, 'expected at least 2 destinations in Laguna');
  });

  console.log('\nSearch and filters');
  await check('search matches the name, case-insensitively', async () => {
    const rows = await destinations.list({ search: 'aGuInAlDo' });
    expect(names(rows).includes('Aguinaldo Shrine'), `got ${names(rows)}`);
  });

  await check('search also matches the municipality', async () => {
    const rows = await destinations.list({ search: 'calamba' });
    expect(names(rows).includes('Rizal Shrine'), `got ${names(rows)}`);
    const taal = await destinations.list({ search: 'Taal' });
    expect(names(taal).includes('Basilica of St. Martin de Tours'), `got ${names(taal)}`);
  });

  await check('search with punctuation is safe (dots, commas, quotes, %, _, parentheses)', async () => {
    const dotted = await destinations.list({ search: 'St. Martin' });
    expect(names(dotted).includes('Basilica of St. Martin de Tours'), 'dot broke the search');
    for (const term of ['Rizal, Laguna', '(shrine)', '100%', 'a_b', '"quoted"', 'back\\slash', '%', '_', 'a,b.c:(d)']) {
      const rows = await destinations.list({ search: term });
      expect(Array.isArray(rows), `search for ${term} failed`);
    }
    expect((await destinations.list({ search: '%' })).length === 0, '"%" acted as a wildcard');
    expect((await destinations.list({ search: '_' })).length === 0, '"_" acted as a wildcard');
    expect(buildSearchFilter('   ') === null, 'blank search should be ignored');
  });

  await check('category filter', async () => {
    const rows = await destinations.list({ category: 'Historical Site' });
    expect(rows.length >= 2 && rows.every((row) => row.category === 'Historical Site'), `got ${names(rows)}`);
  });

  await check('province filter', async () => {
    const rows = await destinations.list({ province: 'Laguna' });
    expect(rows.length >= 2 && rows.every((row) => row.province === 'Laguna'), `got ${names(rows)}`);
  });

  await check('category + province combine with AND', async () => {
    const rows = await destinations.list({ category: 'Historical Site', province: 'Cavite' });
    expect(names(rows).includes('Aguinaldo Shrine'), `got ${names(rows)}`);
    expect(rows.every((row) => row.category === 'Historical Site' && row.province === 'Cavite'), 'filter leak');
    const none = await destinations.list({ category: 'Natural Wonder', province: 'Cavite' });
    expect(none.every((row) => row.category === 'Natural Wonder' && row.province === 'Cavite'), 'filter leak');
  });

  await check('search + category + province all combine', async () => {
    const hit = await destinations.list({ search: 'shrine', category: 'Historical Site', province: 'Laguna' });
    expect(JSON.stringify(names(hit)) === JSON.stringify(['Rizal Shrine']), `got ${names(hit)}`);
    const miss = await destinations.list({ search: 'shrine', category: 'Natural Wonder', province: 'Laguna' });
    expect(miss.length === 0, `expected no rows, got ${names(miss)}`);
    // "falls" must not match through the OR when the province excludes it.
    const scoped = await destinations.list({ search: 'falls', province: 'Quezon' });
    expect(scoped.length === 0, `expected no rows, got ${names(scoped)}`);
  });

  console.log('\nStorage');
  await check('upload a JPEG, read it back from its public URL', async () => {
    let jpeg;
    try {
      const response = await fetch('https://picsum.photos/seed/verify-crud/640/400');
      jpeg = Buffer.from(await response.arrayBuffer());
    } catch {
      jpeg = Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 256));
    }
    // Same path as the app: Base64 from the image manipulator → ArrayBuffer.
    uploadedUrl = await images.uploadCover(base64ToArrayBuffer(jpeg.toString('base64')));
    expect(storagePathFromPublicUrl(uploadedUrl)?.startsWith('covers/'), `unexpected URL ${uploadedUrl}`);
    const download = await fetch(uploadedUrl);
    expect(download.ok, `public URL returned HTTP ${download.status}`);
    const body = Buffer.from(await download.arrayBuffer());
    expect(body.equals(jpeg), 'downloaded bytes differ from the upload');
    expect((download.headers.get('content-type') ?? '').includes('image/jpeg'), 'wrong content type');
  });

  await check('foreign URLs are never treated as bucket files', async () => {
    expect(storagePathFromPublicUrl('https://picsum.photos/seed/x/1200/800') === null, 'picsum URL matched');
    expect((await images.removeByPublicUrl('https://picsum.photos/seed/x/1200/800')) === false, 'tried to remove');
    expect((await images.removeByPublicUrl(null)) === false, 'null URL');
  });

  console.log('\nCreate, update, delete');
  await check('create() inserts and returns the new row', async () => {
    const input = toDestinationInput(
      {
        ...EMPTY_FORM_VALUES,
        name: `${MARKER} Taal Volcano`,
        description: 'Temporary row created by scripts/verify-crud.mjs.',
        address: 'Talisay, Batangas',
        municipality: 'Talisay',
        province: 'Batangas',
        category: 'Natural Wonder',
        latitude: '14.0113',
        longitude: '120.9977',
      },
      uploadedUrl,
    );
    created = await destinations.create(input);
    expect(created.id && created.name === input.name, 'row not returned');
    expect(created.latitude === 14.0113 && created.history === null, 'columns not stored as expected');
    expect(created.cover_image_url === uploadedUrl, 'cover URL not stored');
    const found = await destinations.list({ search: MARKER, province: 'Batangas', category: 'Natural Wonder' });
    expect(found.some((row) => row.id === created.id), 'new row not found by search + filters');
  });

  await check('database rejects a province outside CALABARZON', async () => {
    let rejected = false;
    try {
      const row = await destinations.create({
        name: `${MARKER} invalid`,
        description: 'x',
        address: 'x',
        province: 'Bulacan',
        category: 'Natural Wonder',
      });
      await destinations.remove(row.id);
    } catch {
      rejected = true;
    }
    expect(rejected, 'CHECK constraint did not fire');
  });

  await check('update() saves changes and refreshes updated_at', async () => {
    expect(created, 'no row to update');
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const updated = await destinations.update(created.id, {
      name: `${MARKER} Taal Volcano (edited)`,
      history: 'Edited by the verification script.',
      municipality: null,
    });
    expect(updated.name.endsWith('(edited)'), 'name not updated');
    expect(updated.history === 'Edited by the verification script.', 'history not updated');
    expect(updated.municipality === null, 'municipality not cleared');
    expect(new Date(updated.updated_at) > new Date(created.updated_at), 'updated_at did not move');
    expect(updated.created_at === created.created_at, 'created_at changed');
    created = updated;
  });

  await check('update() on a missing row reports not-found', async () => {
    let kind = null;
    try {
      await destinations.update('00000000-0000-0000-0000-000000000000', { name: 'x' });
    } catch (error) {
      kind = error.kind;
    }
    expect(kind === 'not-found', `expected not-found, got ${kind}`);
  });

  await check('remove() deletes the row', async () => {
    expect(created, 'no row to delete');
    await destinations.remove(created.id);
    expect((await destinations.getById(created.id)) === null, 'row still exists');
    created = null;
  });

  await check('removeByPublicUrl() deletes the uploaded photo', async () => {
    expect(uploadedUrl, 'no upload to remove');
    expect(await images.removeByPublicUrl(uploadedUrl), 'remove reported failure');
    const { data } = await client.storage
      .from('destination-images')
      .list('covers', { search: storagePathFromPublicUrl(uploadedUrl).split('/')[1] });
    expect((data ?? []).length === 0, 'file is still listed in the bucket');
    uploadedUrl = null;
  });

  // --- clean-up, even after failures ---
  const leftovers = await destinations.list({ search: MARKER }).catch(() => []);
  for (const row of leftovers) await destinations.remove(row.id).catch(() => {});
  if (uploadedUrl) await images.removeByPublicUrl(uploadedUrl);

  const remaining = await destinations.list().catch(() => []);
  console.log(`\n${passed} passed, ${failures.length} failed · ${remaining.length} destinations in the database`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
