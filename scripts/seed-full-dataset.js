#!/usr/bin/env node
/**
 * Seeds the complete, real dataset: 26 CALABARZON destinations with their
 * photos and quizzes, from data/destinations-seed.json.
 *
 *   npm run db:seed      (also the last step of `npm run db:setup`)
 *
 * Idempotent — run it as often as you like. Each run:
 *   1. validates the JSON (nothing is touched if it is not valid);
 *   2. makes sure every processed photo exists in data/images (fetching any
 *      missing one from Wikimedia Commons);
 *   3. uploads the photos to Supabase Storage at <slug>/cover.jpg,
 *      <slug>/gallery-1.jpg and <slug>/gallery-2.jpg, overwriting in place;
 *   4. in ONE database transaction, deletes every existing destination (the
 *      cascade removes their photos, quizzes, attempts and completions) and
 *      inserts the 26 destinations, 78 photo rows, 130 questions and 520
 *      options;
 *   5. deletes every file left in the bucket that the dataset does not use
 *      (old placeholders, photos uploaded from the app for deleted entries).
 *
 * WARNING: destinations added from the app are deleted by this script, and so
 * is all quiz / progress data. That is what "reset" means here.
 *
 * Database writes go through SUPABASE_DB_URL with `pg`; storage goes through
 * supabase-js with the publishable key, exactly like the app.
 */

const { createClient } = require('@supabase/supabase-js');

const {
  BUCKET,
  loadDataset,
  stableId,
} = require('./lib/dataset');
const { connect } = require('./lib/db');
const { readEnvFile } = require('./lib/env');
const { ensureImages, writeImageCredits } = require('./lib/images');

const UPLOAD_CONCURRENCY = 4;
/** Photos never change at a given `?v=` URL, so let clients cache for a year. */
const CACHE_SECONDS = '31536000';

function storageClient() {
  const env = readEnvFile();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing in .env');
  }
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return { bucket: supabase.storage.from(BUCKET), baseUrl: url };
}

/** Runs `worker` over `items` with a small, fixed number in flight. */
async function inBatches(items, size, worker) {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(worker));
  }
}

async function uploadPhotos(bucket, photos) {
  await inBatches(photos, UPLOAD_CONCURRENCY, async (photo) => {
    const { error } = await bucket.upload(photo.storage, photo.buffer, {
      contentType: 'image/jpeg',
      cacheControl: CACHE_SECONDS,
      upsert: true,
    });
    if (error) throw new Error(`Upload of ${photo.storage} failed: ${error.message}`);
  });
}

/** Every object path in the bucket, walking folders. */
async function listAllFiles(bucket, prefix = '') {
  const files = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await bucket.list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`Listing "${prefix || '/'}" failed: ${error.message}`);
    for (const entry of data) {
      const full = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) files.push(...(await listAllFiles(bucket, full)));
      else files.push(full);
    }
    if (data.length < pageSize) break;
  }
  return files;
}

async function removeStaleFiles(bucket, keep) {
  const stale = (await listAllFiles(bucket)).filter((file) => !keep.has(file));
  for (let index = 0; index < stale.length; index += 100) {
    const { error } = await bucket.remove(stale.slice(index, index + 100));
    if (error) throw new Error(`Removing old files failed: ${error.message}`);
  }
  return stale.length;
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

/** Turns the dataset into rows for the four tables, with stable ids. */
function buildRows(dataset, photos, baseUrl) {
  const publicUrl = (photo) =>
    `${baseUrl}/storage/v1/object/public/${BUCKET}/${photo.storage}?v=${photo.version}`;
  const photoFor = new Map(photos.map((photo) => [photo.storage, photo]));

  const rows = { destinations: [], images: [], questions: [], options: [] };

  for (const destination of dataset.destinations) {
    const destinationId = stableId(destination.slug);
    const urls = destination.images.map((image) =>
      publicUrl(photoFor.get(`${destination.slug}/${image.file}`)),
    );

    rows.destinations.push([
      destinationId,
      destination.name,
      destination.description,
      destination.address,
      destination.municipality,
      destination.province,
      destination.category,
      destination.latitude,
      destination.longitude,
      destination.history,
      destination.cultural_significance,
      urls[0],
      typeof destination.has_panorama === 'boolean' ? destination.has_panorama : null,
    ]);

    // The cover is also row 0 of the gallery, so its photo credit is stored.
    destination.images.forEach((image, index) => {
      rows.images.push([
        stableId(`${destination.slug}/${image.file}`),
        destinationId,
        urls[index],
        image.caption,
        index,
      ]);
    });

    destination.quiz.forEach((item, questionIndex) => {
      const questionId = stableId(`${destination.slug}/q${questionIndex + 1}`);
      rows.questions.push([questionId, destinationId, item.question, questionIndex + 1]);
      item.options.forEach((option, optionIndex) => {
        rows.options.push([
          stableId(`${destination.slug}/q${questionIndex + 1}/o${optionIndex + 1}`),
          questionId,
          option.text,
          option.correct === true,
        ]);
      });
    });
  }
  return rows;
}

/** One multi-row INSERT; `rows` is an array of same-length value arrays. */
async function insertRows(client, table, columns, rows) {
  const chunkSize = 200;
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize);
    const values = [];
    const tuples = chunk.map((row, rowIndex) => {
      values.push(...row);
      const offset = rowIndex * columns.length;
      return `(${columns.map((_, columnIndex) => `$${offset + columnIndex + 1}`).join(', ')})`;
    });
    await client.query(
      `insert into public.${table} (${columns.join(', ')}) values ${tuples.join(', ')}`,
      values,
    );
  }
}

async function writeDatabase(client, rows) {
  await client.query('begin');
  try {
    const removed = await client.query('delete from public.destinations');
    await insertRows(
      client,
      'destinations',
      [
        'id', 'name', 'description', 'address', 'municipality', 'province', 'category',
        'latitude', 'longitude', 'history', 'cultural_significance', 'cover_image_url',
        'has_panorama',
      ],
      rows.destinations,
    );
    await insertRows(
      client,
      'destination_images',
      ['id', 'destination_id', 'image_url', 'caption', 'sort_order'],
      rows.images,
    );
    await insertRows(
      client,
      'quiz_questions',
      ['id', 'destination_id', 'question_text', 'sort_order'],
      rows.questions,
    );
    await insertRows(
      client,
      'quiz_options',
      ['id', 'question_id', 'option_text', 'is_correct'],
      rows.options,
    );
    await client.query('commit');
    return removed.rowCount;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Seeds the full dataset. Pass an open pg client to reuse a connection
 * (db-setup does); otherwise one is opened and closed here.
 */
async function seedFullDataset({ client = null, log = console.log } = {}) {
  const dataset = loadDataset();
  log(`  dataset valid: ${dataset.destinations.length} destinations`);

  const photos = await ensureImages(dataset, { log });
  writeImageCredits(dataset);
  const totalKb = Math.round(photos.reduce((sum, photo) => sum + photo.bytes, 0) / 1024);
  log(`  ${photos.length} photos ready (${totalKb} KB in total)`);

  const { bucket, baseUrl } = storageClient();
  await uploadPhotos(bucket, photos);
  log(`  uploaded ${photos.length} photos to the "${BUCKET}" bucket`);

  const rows = buildRows(dataset, photos, baseUrl);
  const ownClient = client === null;
  const db = client || (await connect({ log }));
  try {
    const removed = await writeDatabase(db, rows);
    log(
      `  database: removed ${removed} old destination(s); inserted ${rows.destinations.length} ` +
        `destinations, ${rows.images.length} photos, ${rows.questions.length} questions, ` +
        `${rows.options.length} options`,
    );
  } finally {
    if (ownClient) await db.end().catch(() => {});
  }

  const stale = await removeStaleFiles(bucket, new Set(photos.map((photo) => photo.storage)));
  log(`  storage: removed ${stale} file(s) no longer in use`);

  return { destinations: rows.destinations.length, photos: photos.length };
}

module.exports = {
  seedFullDataset,
  // Exported for rehearsals and tests.
  buildRows,
  listAllFiles,
  removeStaleFiles,
  storageClient,
  uploadPhotos,
  writeDatabase,
};

if (require.main === module) {
  console.log('Seeding the full dataset');
  seedFullDataset()
    .then(() => console.log('\nDone. Run `npm run db:verify` to check the result.'))
    .catch((error) => {
      console.error(`\n${error.message}`);
      process.exit(1);
    });
}
