/**
 * End-to-end check of the data layer against the LIVE Supabase project.
 *
 *   npm run db:test
 *
 * It imports the app's real repositories (src/repositories) and pure logic
 * (form validation, Featured selection), and talks to Supabase exactly the way
 * the app does: through the Data API with the publishable key (the `anon`
 * role). So a pass here means the RLS policies, grants, storage policies and
 * query code all work together — against the real 26-destination dataset.
 *
 * Every row and file it creates is removed again; the dataset is untouched.
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
import { countDestinations, pickFeatured } from '../src/lib/featured.ts';
import {
  createDestinationImagesRepository,
  storagePathFromPublicUrl,
} from '../src/repositories/destinationImages.ts';
import { buildSearchFilter, createDestinationsRepository } from '../src/repositories/destinations.ts';
import { createFavoritesRepository } from '../src/repositories/favorites.ts';
import { createProgressRepository } from '../src/repositories/progress.ts';
import { countCredits, groupCredits } from '../src/lib/credits.ts';
import { favoriteDestinations } from '../src/lib/favorites.ts';
import { distanceFrom, sortByDistance } from '../src/lib/geo.ts';
import { createQuizRepository } from '../src/repositories/quiz.ts';
import { bestScoresByDestination, summarizeProgress } from '../src/lib/progress.ts';
import { prepareQuiz, scoreQuiz } from '../src/lib/quiz.ts';
import { evaluateBadges } from '../src/lib/achievements.ts';
import { syncAutoQuiz } from '../src/lib/autoQuiz.ts';
import { qualifyingCertificates } from '../src/lib/certificate.ts';
import { computeInsights } from '../src/lib/insights.ts';
import { summarizeRatings, summarizeStars } from '../src/lib/ratings.ts';
import { createRatingsRepository } from '../src/repositories/ratings.ts';

const MARKER = '[verify-crud]';
const BUCKET_MARKER = '/storage/v1/object/public/destination-images/';
const CREDIT_PATTERN = /^Photo: .+, .+, via Wikimedia Commons$/;
const PROVINCES = ['Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon'];

const fromRoot = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));

// --- the dataset the database is expected to hold ---
const dataset = JSON.parse(readFileSync(fromRoot('data/destinations-seed.json'), 'utf8'));
const expected = dataset.destinations;

// --- environment (EXPO_PUBLIC_* only — the same values the app ships with) ---
const env = Object.fromEntries(
  readFileSync(fromRoot('.env'), 'utf8')
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
const quiz = createQuizRepository(client);
const progress = createProgressRepository(client);
const favorites = createFavoritesRepository(client);
const ratings = createRatingsRepository(client);

/** Throwaway "user key" for the progress checks; every row it writes is removed. */
const TEST_USER_KEY = `verify-crud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const TEST_GUEST_KEY = `${TEST_USER_KEY}-guest`;
/** Run 6: separate throwaway keys for the ratings / badges checks. */
const R6_USER_KEY = `${TEST_USER_KEY}-r6`;
const R6_GUEST_KEY = `${TEST_USER_KEY}-r6-guest`;

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
const sameList = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const byName = (name) => expected.find((destination) => destination.name === name);

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
  await check('list() returns all 26 dataset destinations, A–Z, as light summaries', async () => {
    all = await destinations.list();
    const present = new Set(names(all));
    const missing = expected.filter((destination) => !present.has(destination.name));
    expect(missing.length === 0, `missing from the database: ${names(missing).join(', ')}`);
    expect(all.length >= expected.length, `expected at least ${expected.length} rows, got ${all.length}`);
    const sorted = [...names(all)].sort((a, b) => a.localeCompare(b));
    expect(sameList(names(all), sorted), 'not sorted by name');
    expect(!('history' in all[0]) && !('description' in all[0]), 'list rows should not carry the long texts');
    expect(all.every((row) => row.id && row.name && row.province && row.category), 'summary fields missing');
  });

  await check('Photo Credits: listAll() returns all 78 credited photos, grouped under 26 destinations', async () => {
    const rows = await images.listAll();
    expect(rows.length >= expected.length * 3, `only ${rows.length} photo rows`);
    expect(rows.every((row) => CREDIT_PATTERN.test(row.caption ?? '')), 'a photo row lacks a proper credit line');
    const groups = groupCredits(all, rows);
    expect(groups.length >= expected.length, `${groups.length} credit groups`);
    expect(countCredits(groups) === rows.length, 'credits lost while grouping');
    expect(groups.every((group) => group.credits[0].position === 0), 'cover not first');
  });

  await check('summaries carry coordinates for Near me; nearest-first sort from Calamba works', async () => {
    const placed = all.filter((row) => typeof row.latitude === 'number' && typeof row.longitude === 'number');
    expect(placed.length >= expected.length, `only ${placed.length} summaries have coordinates`);
    const calamba = { latitude: 14.2117, longitude: 121.1653 };
    const nearest = sortByDistance(all, calamba);
    expect(nearest[0].name === 'Rizal Shrine', `nearest to Calamba is ${nearest[0].name}`);
    const km = nearest.map((row) => distanceFrom(calamba, row)).filter((value) => value !== null);
    expect(km.every((value, index) => index === 0 || value >= km[index - 1]), 'not sorted by distance');
  });

  await check('getById() returns the full text; unknown and malformed ids return null', async () => {
    const summary = all.find((row) => row.name === 'Rizal Shrine');
    const full = await destinations.getById(summary.id);
    const source = byName('Rizal Shrine');
    expect(full?.name === 'Rizal Shrine', 'wrong row returned');
    expect(full.description === source.description, 'description differs from the dataset');
    expect(full.history === source.history, 'history differs from the dataset');
    expect(full.cultural_significance === source.cultural_significance, 'cultural significance differs from the dataset');
    expect(full.address === source.address && full.latitude === source.latitude, 'address or coordinates differ');
    expect((await destinations.getById('00000000-0000-0000-0000-000000000000')) === null, 'unknown id');
    expect((await destinations.getById('not-a-uuid')) === null, 'malformed id');
  });

  await check('countDestinations() matches the dataset: 5 / 6 / 5 / 5 / 5 per province', async () => {
    const seeded = all.filter((row) => byName(row.name));
    const counts = countDestinations(seeded);
    const sum = (record) => Object.values(record).reduce((a, b) => a + b, 0);
    expect(counts.total === 26, `total is ${counts.total}`);
    expect(sum(counts.byCategory) === 26 && sum(counts.byProvince) === 26, 'counts do not add up');
    expect(
      sameList(PROVINCES.map((province) => counts.byProvince[province]), [5, 6, 5, 5, 5]),
      `per-province counts are ${JSON.stringify(counts.byProvince)}`,
    );
    for (const destination of expected) {
      const row = all.find((item) => item.name === destination.name);
      expect(row.province === destination.province, `${destination.name}: wrong province`);
      expect(row.category === destination.category, `${destination.name}: wrong category`);
      expect(row.municipality === destination.municipality, `${destination.name}: wrong municipality`);
    }
  });

  await check('pickFeatured() gives 6 varied destinations covering all five provinces', async () => {
    for (const rotation of [0, 1, 2, 3, 4, 17, 20410]) {
      const featured = pickFeatured(all, 6, rotation);
      expect(featured.length === 6, `rotation ${rotation}: got ${featured.length}`);
      expect(new Set(featured.map((row) => row.id)).size === 6, `rotation ${rotation}: duplicates`);
      expect(new Set(featured.map((row) => row.province)).size === 5, `rotation ${rotation}: a province is missing`);
      expect(new Set(featured.map((row) => row.category)).size >= 4, `rotation ${rotation}: too few categories`);
      expect(featured.every((row) => row.cover_image_url), `rotation ${rotation}: a card has no photo`);
      expect(sameList(names(featured), names(pickFeatured(all, 6, rotation))), 'not deterministic');
    }
    expect(
      !sameList(names(pickFeatured(all, 6, 0)), names(pickFeatured(all, 6, 1))),
      'the line-up should change from day to day',
    );
    expect(pickFeatured([], 6).length === 0, 'empty input');
    expect(pickFeatured(all.slice(0, 2), 6).length === 2, 'fewer destinations than the limit');
  });

  console.log('\nDataset content');
  await check('every destination has a real cover photo in our bucket (no placeholders)', async () => {
    for (const row of all.filter((item) => byName(item.name))) {
      expect(row.cover_image_url?.includes(BUCKET_MARKER), `${row.name}: cover is ${row.cover_image_url}`);
      expect(!/picsum/i.test(row.cover_image_url), `${row.name}: placeholder cover`);
    }
  });

  await check('each destination has 3 credited photos, cover first', async () => {
    for (const destination of expected) {
      const row = all.find((item) => item.name === destination.name);
      const photos = await images.listForDestination(row.id);
      expect(photos.length === 3, `${destination.name}: ${photos.length} photos`);
      expect(photos[0].image_url === row.cover_image_url, `${destination.name}: first photo is not the cover`);
      expect(sameList(photos.map((photo) => photo.sort_order), [0, 1, 2]), `${destination.name}: wrong order`);
      photos.forEach((photo, index) => {
        expect(CREDIT_PATTERN.test(photo.caption ?? ''), `${destination.name}: bad credit "${photo.caption}"`);
        expect(photo.caption === destination.images[index].caption, `${destination.name}: credit differs from the dataset`);
        expect(photo.image_url.includes(`${BUCKET_MARKER}${destination.slug}/${destination.images[index].file}`), `${destination.name}: unexpected path`);
      });
    }
  });

  await check('a cover and a gallery photo download as JPEGs under 1 MB', async () => {
    const row = all.find((item) => item.name === 'Taal Volcano & Lake');
    const photos = await images.listForDestination(row.id);
    for (const photo of [photos[0], photos[2]]) {
      const response = await fetch(photo.image_url);
      expect(response.ok, `HTTP ${response.status} for ${photo.image_url}`);
      expect((response.headers.get('content-type') ?? '').includes('image/jpeg'), 'wrong content type');
      const bytes = (await response.arrayBuffer()).byteLength;
      expect(bytes > 30_000 && bytes < 1_000_000, `unexpected size ${bytes}`);
    }
  });

  await check('quiz bank: 130 questions, 5 per destination, 4 options with exactly 1 correct', async () => {
    const { data, error } = await client
      .from('quiz_questions')
      .select('id, destination_id, question_text, sort_order, quiz_options(option_text, is_correct)');
    expect(!error, error?.message);
    const seededIds = new Map(all.filter((row) => byName(row.name)).map((row) => [row.id, row.name]));
    const questions = data.filter((question) => seededIds.has(question.destination_id));
    expect(questions.length === 130, `found ${questions.length} questions`);
    for (const [id, name] of seededIds) {
      const mine = questions.filter((question) => question.destination_id === id);
      expect(mine.length === 5, `${name}: ${mine.length} questions`);
      const source = byName(name);
      for (const question of mine) {
        const options = question.quiz_options;
        expect(options.length === 4, `${name}: a question has ${options.length} options`);
        expect(options.filter((option) => option.is_correct).length === 1, `${name}: not exactly one correct option`);
        const original = source.quiz.find((item) => item.question === question.question_text);
        expect(original, `${name}: question not in the dataset: ${question.question_text}`);
        const correct = options.find((option) => option.is_correct).option_text;
        expect(correct === original.options.find((option) => option.correct).text, `${name}: wrong option marked correct`);
      }
    }
  });

  console.log('\nSearch and filters');
  await check('search matches the name, case-insensitively', async () => {
    const rows = await destinations.list({ search: 'aGuInAlDo' });
    expect(names(rows).includes('Aguinaldo Shrine'), `got ${names(rows)}`);
  });

  await check('search also matches the municipality', async () => {
    const rows = await destinations.list({ search: 'calamba' });
    expect(names(rows).includes('Rizal Shrine'), `got ${names(rows)}`);
    const lucban = await destinations.list({ search: 'Lucban' });
    expect(names(lucban).includes('Kamay ni Hesus Shrine'), `municipality match missing: ${names(lucban)}`);
    expect(names(lucban).includes('Lucban Heritage Town & Pahiyas Festival'), `name match missing: ${names(lucban)}`);
  });

  await check('search with punctuation is safe (dots, commas, quotes, %, _, parentheses)', async () => {
    const dotted = await destinations.list({ search: 'St. Martin' });
    expect(names(dotted).includes('Taal Heritage Town & Basilica of St. Martin de Tours'), 'dot broke the search');
    const ampersand = await destinations.list({ search: 'Volcano & Lake' });
    expect(sameList(names(ampersand), ['Taal Volcano & Lake']), `ampersand search gave ${names(ampersand)}`);
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
    const wanted = expected.filter((d) => d.category === 'Historical Site').map((d) => d.name).sort((a, b) => a.localeCompare(b));
    expect(rows.every((row) => row.category === 'Historical Site'), 'filter leak');
    expect(sameList(names(rows).filter((name) => byName(name)), wanted), `got ${names(rows)}`);
  });

  await check('province filter', async () => {
    const rows = await destinations.list({ province: 'Laguna' });
    expect(rows.every((row) => row.province === 'Laguna'), 'filter leak');
    expect(rows.filter((row) => byName(row.name)).length === 6, `expected 6 in Laguna, got ${names(rows)}`);
  });

  await check('category + province combine with AND', async () => {
    const rows = await destinations.list({ category: 'Historical Site', province: 'Cavite' });
    expect(
      sameList(names(rows).filter((name) => byName(name)), ['Aguinaldo Shrine', 'Bonifacio Trial House', 'Corregidor Island']),
      `got ${names(rows)}`,
    );
    const none = await destinations.list({ category: 'Museum & Art', province: 'Cavite' });
    expect(none.filter((row) => byName(row.name)).length === 0, `expected none, got ${names(none)}`);
  });

  await check('search + category + province all combine', async () => {
    const hit = await destinations.list({ search: 'shrine', category: 'Historical Site', province: 'Laguna' });
    expect(sameList(names(hit), ['Rizal Shrine']), `got ${names(hit)}`);
    const miss = await destinations.list({ search: 'shrine', category: 'Natural Wonder', province: 'Laguna' });
    expect(miss.length === 0, `expected no rows, got ${names(miss)}`);
    // "falls" must not match through the OR when the province excludes it.
    const scoped = await destinations.list({ search: 'falls', province: 'Quezon' });
    expect(scoped.length === 0, `expected no rows, got ${names(scoped)}`);
    const falls = await destinations.list({ search: 'falls', category: 'Natural Wonder' });
    expect(sameList(names(falls), ['Daranak Falls', 'Pagsanjan Falls']), `got ${names(falls)}`);
  });

  console.log('\nStorage');
  await check('upload a JPEG the way the app does, read it back from its public URL', async () => {
    // A real processed photo from the dataset stands in for one picked on a phone.
    const jpeg = readFileSync(fromRoot('data/images/rizal-shrine/gallery-1.jpg'));
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
    const elsewhere = 'https://upload.wikimedia.org/wikipedia/commons/a/a0/Example.jpg';
    expect(storagePathFromPublicUrl(elsewhere) === null, 'foreign URL matched');
    expect((await images.removeByPublicUrl(elsewhere)) === false, 'tried to remove');
    expect((await images.removeByPublicUrl(null)) === false, 'null URL');
    expect((await images.removeFilesByPublicUrl([elsewhere, null, undefined])) === 0, 'nothing should be removed');
    const versioned = `${url}${BUCKET_MARKER}rizal-shrine/cover.jpg?v=abc123`;
    expect(storagePathFromPublicUrl(versioned) === 'rizal-shrine/cover.jpg', 'version query not stripped');
  });

  console.log('\nCreate, update, delete');
  await check('create() inserts and returns the new row', async () => {
    const input = toDestinationInput(
      {
        ...EMPTY_FORM_VALUES,
        name: `${MARKER} Test Lake`,
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
      name: `${MARKER} Test Lake (edited)`,
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

  await check('photo rows: listed in order, and dropped when a cover is replaced', async () => {
    expect(created && uploadedUrl, 'no row / upload to work with');
    const { error } = await client.from('destination_images').insert([
      { destination_id: created.id, image_url: uploadedUrl, caption: 'Photo: Test, CC0, via Wikimedia Commons', sort_order: 0 },
      { destination_id: created.id, image_url: `${uploadedUrl}#second`, caption: null, sort_order: 1 },
    ]);
    expect(!error, error?.message);
    const before = await images.listForDestination(created.id);
    expect(sameList(before.map((photo) => photo.sort_order), [0, 1]), 'photos not in order');
    await images.removeRecordByUrl(created.id, uploadedUrl);
    const after = await images.listForDestination(created.id);
    expect(after.length === 1 && after[0].sort_order === 1, 'the replaced cover row is still listed');
  });

  await check('remove() deletes the row and its photo rows cascade', async () => {
    expect(created, 'no row to delete');
    const id = created.id;
    await destinations.remove(id);
    expect((await destinations.getById(id)) === null, 'row still exists');
    expect((await images.listForDestination(id)).length === 0, 'photo rows were not removed');
    created = null;
  });

  await check('removeFilesByPublicUrl() deletes the uploaded photo', async () => {
    expect(uploadedUrl, 'no upload to remove');
    expect((await images.removeFilesByPublicUrl([uploadedUrl, uploadedUrl])) === 1, 'remove reported failure');
    const { data } = await client.storage
      .from('destination-images')
      .list('covers', { search: storagePathFromPublicUrl(uploadedUrl).split('/')[1] });
    expect((data ?? []).length === 0, 'file is still listed in the bucket');
    uploadedUrl = null;
  });

  // --- Phase 2: quiz + progress, under a throwaway user key ---
  const [first, second] = await destinations.list().catch(() => []);

  await check('quiz repository: 5 questions in order, 4 options each, exactly 1 correct', async () => {
    const questions = await quiz.getForDestination(first.id);
    expect(questions.length === 5, `expected 5 questions, got ${questions.length}`);
    expect(sameList(questions.map((q) => q.sort_order), [1, 2, 3, 4, 5]), 'questions out of order');
    for (const q of questions) {
      expect(q.options.length === 4, `${q.id}: ${q.options.length} options`);
      expect(q.options.filter((o) => o.is_correct).length === 1, `${q.id}: not exactly 1 correct`);
    }
    // Scoring the real quiz: all-correct answers give 5/5 after shuffling.
    const shuffled = prepareQuiz(questions);
    const answers = Object.fromEntries(shuffled.map((q) => [q.id, q.options.find((o) => o.is_correct).id]));
    const result = scoreQuiz(shuffled, answers);
    expect(result.score === 5 && result.percent === 100, `perfect answers scored ${result.score}`);
  });

  await check('recordAttempt() writes a quiz_attempts row under the user key', async () => {
    const row = await progress.recordAttempt({ userKey: TEST_USER_KEY, destinationId: first.id, score: 3, total: 5 });
    expect(row.device_id === TEST_USER_KEY && row.score === 3 && row.total === 5, 'row does not match');
    const listed = await progress.listAttempts(TEST_USER_KEY);
    expect(listed.length === 1 && listed[0].id === row.id, 'attempt not listed for the user key');
  });

  await check('best score is the highest attempt, not the latest', async () => {
    await progress.recordAttempt({ userKey: TEST_USER_KEY, destinationId: first.id, score: 5, total: 5 });
    await progress.recordAttempt({ userKey: TEST_USER_KEY, destinationId: first.id, score: 4, total: 5 });
    await progress.recordAttempt({ userKey: TEST_USER_KEY, destinationId: second.id, score: 2, total: 5 });
    const forFirst = await progress.listAttempts(TEST_USER_KEY, first.id);
    expect(forFirst.length === 3, `expected 3 attempts for the first destination, got ${forFirst.length}`);
    const best = bestScoresByDestination(await progress.listAttempts(TEST_USER_KEY));
    expect(best.get(first.id)?.score === 5, `best for first = ${best.get(first.id)?.score}`);
    expect(best.get(second.id)?.score === 2, `best for second = ${best.get(second.id)?.score}`);
  });

  await check('markVisited() is idempotent per user key (unique constraint holds)', async () => {
    const one = await progress.markVisited(TEST_USER_KEY, first.id);
    const two = await progress.markVisited(TEST_USER_KEY, first.id);
    expect(one.id === two.id, 'a second visit created a new row');
    expect(one.completed_at === two.completed_at, 'the first visit date was overwritten');
    const visits = await progress.listCompletions(TEST_USER_KEY);
    expect(visits.length === 1, `expected 1 completion, got ${visits.length}`);
    expect((await progress.getCompletion(TEST_USER_KEY, second.id)) === null, 'unvisited place reported as visited');
  });

  await check('progress is isolated per user key', async () => {
    expect((await progress.listCompletions(TEST_GUEST_KEY)).length === 0, 'another key sees completions');
    expect((await progress.listAttempts(TEST_GUEST_KEY)).length === 0, 'another key sees attempts');
  });

  await check('Progress tab summary from live rows: 1 visited, 4 quizzes, best 5/5, average 70%', async () => {
    const summary = summarizeProgress(
      await destinations.list(),
      await progress.listCompletions(TEST_USER_KEY),
      await progress.listAttempts(TEST_USER_KEY),
    );
    expect(summary.totalDestinations >= 26, 'catalogue not loaded');
    expect(summary.visitedCount === 1, `visited ${summary.visitedCount}`);
    expect(summary.quizzesTaken === 4, `quizzes ${summary.quizzesTaken}`);
    expect(summary.best?.score === 5, 'best score wrong');
    expect(summary.averagePercent === 70, `average ${summary.averagePercent} (expected (60+100+80+40)/4 = 70)`);
    expect(summary.journey.length === 2, `journey has ${summary.journey.length} entries`);
  });

  // --- Run 4: favorites, under the same throwaway user keys ---
  await check('favorites: add is idempotent, list is newest first, remove works', async () => {
    await favorites.add(TEST_USER_KEY, first.id);
    await new Promise((resolve) => setTimeout(resolve, 20));
    await favorites.add(TEST_USER_KEY, second.id);
    await favorites.add(TEST_USER_KEY, second.id); // again: no error, no duplicate
    let rows = await favorites.list(TEST_USER_KEY);
    expect(rows.length === 2, `expected 2 favorites, got ${rows.length}`);
    expect(rows[0].destination_id === second.id, 'not newest first');
    expect(rows.every((row) => row.device_id === TEST_USER_KEY), 'wrong user key on a row');
    const shown = favoriteDestinations(all, rows).map((row) => row.id);
    expect(sameList(shown, [second.id, first.id]), 'Progress tab list wrong');
    await favorites.remove(TEST_USER_KEY, second.id);
    await favorites.remove(TEST_USER_KEY, second.id); // removing twice is fine
    rows = await favorites.list(TEST_USER_KEY);
    expect(rows.length === 1 && rows[0].destination_id === first.id, 'remove failed');
  });

  await check('favorites are isolated per user key, and unique per (destination, key) in the database', async () => {
    expect((await favorites.list(TEST_GUEST_KEY)).length === 0, 'another key sees favorites');
    const { error } = await client.from('favorites').insert({ device_id: TEST_USER_KEY, destination_id: first.id });
    expect(error?.code === '23505', `duplicate insert not rejected (got ${error?.code ?? 'no error'})`);
  });

  await check('favorites cascade away when their destination is deleted', async () => {
    const temp = await destinations.create(
      toDestinationInput(
        {
          ...EMPTY_FORM_VALUES,
          name: `${MARKER} Favorite cascade`,
          description: 'Temporary row created by scripts/verify-crud.mjs.',
          address: 'Pila, Laguna',
          province: 'Laguna',
          category: 'Heritage Town & Culture',
        },
        null,
      ),
    );
    await favorites.add(TEST_GUEST_KEY, temp.id);
    expect((await favorites.list(TEST_GUEST_KEY)).length === 1, 'favorite not saved');
    await destinations.remove(temp.id);
    expect((await favorites.list(TEST_GUEST_KEY)).length === 0, 'favorite survived its destination');
  });

  await check('transferProgress() moves guest visits, attempts and favorites onto an account, without duplicates', async () => {
    await progress.markVisited(TEST_GUEST_KEY, first.id); // also visited by the account: dropped
    await progress.markVisited(TEST_GUEST_KEY, second.id); // new for the account: moved
    await progress.recordAttempt({ userKey: TEST_GUEST_KEY, destinationId: second.id, score: 1, total: 5 });
    await favorites.add(TEST_GUEST_KEY, first.id); // the account has this favorite already: dropped
    await favorites.add(TEST_GUEST_KEY, second.id); // new for the account: moved
    await progress.transferProgress(TEST_GUEST_KEY, TEST_USER_KEY);
    expect((await progress.listCompletions(TEST_GUEST_KEY)).length === 0, 'guest visits left behind');
    expect((await progress.listAttempts(TEST_GUEST_KEY)).length === 0, 'guest attempts left behind');
    expect((await favorites.list(TEST_GUEST_KEY)).length === 0, 'guest favorites left behind');
    expect((await progress.listCompletions(TEST_USER_KEY)).length === 2, 'account should now have 2 visits');
    expect((await progress.listAttempts(TEST_USER_KEY)).length === 5, 'account should now have 5 attempts');
    const accountFavorites = (await favorites.list(TEST_USER_KEY)).map((row) => row.destination_id).sort();
    expect(sameList(accountFavorites, [first.id, second.id].sort()), `account favorites: ${accountFavorites}`);
  });

  await check('removeAllFor() clears every row (and favorite) of the test user keys', async () => {
    await progress.removeAllFor(TEST_USER_KEY);
    await progress.removeAllFor(TEST_GUEST_KEY);
    expect((await progress.listCompletions(TEST_USER_KEY)).length === 0, 'completions remain');
    expect((await progress.listAttempts(TEST_USER_KEY)).length === 0, 'attempts remain');
    expect((await favorites.list(TEST_USER_KEY)).length === 0, 'favorites remain');
    expect((await favorites.list(TEST_GUEST_KEY)).length === 0, 'guest favorites remain');
  });

  // --- Run 6: starter quizzes, ratings, insights, badges ---
  console.log('\nRun 6 feature modules');

  await check('quiz_questions.source: every dataset question is curated (130), none auto', async () => {
    let curated = 0;
    let auto = 0;
    for (const destination of await destinations.list()) {
      const counts = await quiz.countBySource(destination.id);
      curated += counts.curated;
      auto += counts.auto;
    }
    expect(curated === 130, `curated questions: ${curated}`);
    expect(auto === 0, `auto questions on the dataset: ${auto}`);
    const loaded = await quiz.getForDestination(first.id);
    expect(loaded.every((question) => question.source === 'curated'), 'source not loaded with the quiz');
  });

  let autoDestination = null;
  await check('create → starter quiz: 5 auto questions, exactly one correct option each', async () => {
    autoDestination = await destinations.create(
      toDestinationInput(
        {
          ...EMPTY_FORM_VALUES,
          name: `${MARKER} Casa Tejeros`,
          description:
            'A restored estate house where revolutionary leaders gathered in 1897. The convention held here elected new officers and changed the course of the uprising in the province.',
          address: 'Rosario, Cavite',
          municipality: 'Rosario',
          province: 'Cavite',
          category: 'Historical Site',
        },
        null,
      ),
    );
    const outcome = await syncAutoQuiz({ quiz, saved: autoDestination, catalogue: await destinations.list() });
    expect(outcome === 'written', `outcome ${outcome}`);
    const questions = await quiz.getForDestination(autoDestination.id);
    expect(questions.length === 5, `expected 5 questions, got ${questions.length}`);
    expect(questions.every((question) => question.source === 'auto'), 'not all auto');
    expect(sameList(questions.map((q) => q.sort_order), [1, 2, 3, 4, 5]), 'sort orders');
    for (const question of questions) {
      expect(question.options.filter((option) => option.is_correct).length === 1, `${question.question_text}: not exactly 1 correct`);
    }
    const shuffled = prepareQuiz(questions);
    const answers = Object.fromEntries(shuffled.map((q) => [q.id, q.options.find((o) => o.is_correct).id]));
    expect(scoreQuiz(shuffled, answers).score === 5, 'the starter quiz does not score 5/5 with right answers');
  });

  await check('edit of a quiz field regenerates the starter quiz; an address-only edit leaves it', async () => {
    const before = await quiz.getForDestination(autoDestination.id);
    const renamed = await destinations.update(autoDestination.id, { name: `${MARKER} Tejeros Convention Site` });
    expect((await syncAutoQuiz({ quiz, saved: renamed, previous: autoDestination, catalogue: await destinations.list() })) === 'written', 'not regenerated');
    const after = await quiz.getForDestination(autoDestination.id);
    expect(after.length === 5, `expected 5 after regeneration, got ${after.length}`);
    expect(!after.some((q) => before.some((old) => old.id === q.id)), 'old auto rows were not replaced');
    expect(after.some((q) => q.question_text.includes('Tejeros Convention Site')), 'new name not used');
    const moved = await destinations.update(autoDestination.id, { address: 'Tejeros, Rosario, Cavite' });
    expect((await syncAutoQuiz({ quiz, saved: moved, previous: renamed, catalogue: [] })) === 'unchanged', 'address edit regenerated');
    const same = await quiz.getForDestination(autoDestination.id);
    expect(sameList(same.map((q) => q.id), after.map((q) => q.id)), 'questions changed on an address edit');
    const { count } = await client.from('quiz_options').select('id', { count: 'exact', head: true }).in('question_id', before.map((q) => q.id));
    expect(count === 0, `${count} options of the old questions left behind`);
  });

  await check('curated quizzes are never touched by the starter-quiz sync', async () => {
    const before = await quiz.getForDestination(first.id);
    const outcome = await syncAutoQuiz({ quiz, saved: { ...first, description: 'x', name: `${first.name} renamed` }, previous: { ...first, description: 'y' }, catalogue: [] });
    expect(outcome === 'skipped-curated', `outcome ${outcome}`);
    const after = await quiz.getForDestination(first.id);
    expect(sameList(after.map((q) => q.id), before.map((q) => q.id)), 'curated questions changed');
    expect(after.every((q) => q.source === 'curated'), 'source changed');
  });

  await check('a starter quiz cascades away with its destination', async () => {
    const ids = (await quiz.getForDestination(autoDestination.id)).map((q) => q.id);
    await destinations.remove(autoDestination.id);
    const { count } = await client.from('quiz_questions').select('id', { count: 'exact', head: true }).in('id', ids);
    expect(count === 0, `${count} questions left`);
    autoDestination = null;
  });

  await check('ratings: rate() upserts — re-rating replaces the stars, one row per key', async () => {
    const one = await ratings.rate(R6_USER_KEY, first.id, 4);
    const two = await ratings.rate(R6_USER_KEY, first.id, 2);
    expect(one.id === two.id, 're-rating created a new row');
    expect(two.stars === 2, `stars ${two.stars}`);
    expect((await ratings.listMine(R6_USER_KEY)).length === 1, 'more than one row');
    expect((await ratings.getMine(R6_USER_KEY, first.id))?.stars === 2, 'getMine wrong');
  });

  await check('ratings: unique (destination, key) and 1–5 check enforced by the database', async () => {
    const duplicate = await client.from('ratings').insert({ device_id: R6_USER_KEY, destination_id: first.id, stars: 5 });
    expect(duplicate.error?.code === '23505', `duplicate not rejected (${duplicate.error?.code ?? 'no error'})`);
    const tooMany = await client.from('ratings').insert({ device_id: R6_GUEST_KEY, destination_id: first.id, stars: 6 });
    expect(tooMany.error?.code === '23514', `6 stars not rejected (${tooMany.error?.code ?? 'no error'})`);
  });

  await check('ratings: isolated per key; average to one decimal over every key', async () => {
    expect((await ratings.getMine(R6_GUEST_KEY, first.id)) === null, 'another key sees the rating');
    await ratings.rate(R6_GUEST_KEY, first.id, 5);
    const rows = (await ratings.listForDestination(first.id)).filter(() => true);
    const ours = rows.length; // other people may have rated this place too
    const summary = summarizeStars(rows.map((row) => row.stars));
    expect(summary && summary.count === ours, 'count wrong');
    const expected = Math.round((rows.reduce((sum, row) => sum + row.stars, 0) / ours) * 10) / 10;
    expect(summary.average === expected, `average ${summary.average} vs ${expected}`);
    const all = summarizeRatings(await ratings.listAll());
    expect(all[first.id]?.count === ours, 'listAll summary disagrees');
  });

  await check('transferProgress() moves ratings to the account, keeping the account’s own on a clash', async () => {
    // Account (R6_USER_KEY) rated first = 2. Guest rated first = 5 (clash) and now second = 4 (new).
    await ratings.rate(R6_GUEST_KEY, second.id, 4);
    await progress.transferProgress(R6_GUEST_KEY, R6_USER_KEY);
    expect((await ratings.listMine(R6_GUEST_KEY)).length === 0, 'guest ratings left behind');
    const mine = await ratings.listMine(R6_USER_KEY);
    expect(mine.length === 2, `account has ${mine.length} ratings`);
    expect(mine.find((row) => row.destination_id === first.id)?.stars === 2, 'account rating overwritten by the guest copy');
    expect(mine.find((row) => row.destination_id === second.id)?.stars === 4, 'guest rating not moved');
  });

  await check('insights + badges + certificates from live rows', async () => {
    await progress.markVisited(R6_USER_KEY, first.id);
    await progress.recordAttempt({ userKey: R6_USER_KEY, destinationId: first.id, score: 1, total: 5 });
    const catalogue = await destinations.list();
    const insights = computeInsights({
      destinations: catalogue,
      completions: await progress.listAllCompletions(),
      attempts: await progress.listAllAttempts(),
      ratings: await ratings.listAll(),
    });
    expect(insights.mostVisited.some((row) => row.destination.id === first.id), 'visit missing from Most visited');
    expect(insights.topRated.some((row) => row.destination.id === first.id), 'rating missing from Top rated');
    expect(insights.toughestQuizzes.some((row) => row.destination.id === first.id), 'attempt missing from Toughest quizzes');
    const badges = evaluateBadges({
      destinations: catalogue,
      completions: await progress.listCompletions(R6_USER_KEY),
      attempts: await progress.listAttempts(R6_USER_KEY),
      favorites: await favorites.list(R6_USER_KEY),
    });
    const firstJourney = badges.find((entry) => entry.badge.id === 'first-journey');
    expect(firstJourney.earned && firstJourney.earnedAt, 'First Journey not earned / no date');
    expect(qualifyingCertificates(catalogue, await progress.listCompletions(R6_USER_KEY)).length === 0, 'certificate without a full province');
  });

  await check('removeAllFor() also clears ratings', async () => {
    await progress.removeAllFor(R6_USER_KEY);
    await progress.removeAllFor(R6_GUEST_KEY);
    expect((await ratings.listMine(R6_USER_KEY)).length === 0, 'ratings remain');
    expect((await progress.listCompletions(R6_USER_KEY)).length === 0, 'visits remain');
  });

  // --- clean-up, even after failures ---
  await progress.removeAllFor(R6_USER_KEY).catch(() => {});
  await progress.removeAllFor(R6_GUEST_KEY).catch(() => {});
  await progress.removeAllFor(TEST_USER_KEY).catch(() => {});
  await progress.removeAllFor(TEST_GUEST_KEY).catch(() => {});
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
