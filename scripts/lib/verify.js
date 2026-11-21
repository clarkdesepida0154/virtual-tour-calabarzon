/**
 * Checks that the live database holds exactly what the app expects: the seven
 * tables with RLS, the public photo bucket, and the full 26-destination
 * dataset with its photos and quizzes. Read-only.
 */

const {
  BUCKET,
  CATEGORIES,
  EXPECTED_COUNT,
  IMAGE_FILES,
  OPTIONS_PER_QUESTION,
  PROVINCES,
  QUESTIONS_PER_DESTINATION,
  loadDataset,
} = require('./dataset');

const EXPECTED_TABLES = [
  'destination_completions',
  'destination_images',
  'destinations',
  'favorites',
  'quiz_attempts',
  'quiz_options',
  'quiz_questions',
  'ratings',
];
const POLICIES_PER_TABLE = 4;
const URLS_TO_CHECK = 5;

function pickRandom(items, count) {
  const pool = [...items];
  const picked = [];
  while (pool.length > 0 && picked.length < count) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return picked;
}

async function checkTables(client, problems, log) {
  const { rows } = await client.query(
    `select c.relname as name, c.relrowsecurity as rls,
            (select count(*)::int from pg_policies p
              where p.schemaname = 'public' and p.tablename = c.relname) as policies
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname`,
  );
  log('\n  Tables');
  for (const row of rows) {
    log(`    ${row.name.padEnd(26)} RLS ${row.rls ? 'on ' : 'OFF'}  policies: ${row.policies}`);
  }
  const found = new Map(rows.map((row) => [row.name, row]));
  for (const name of EXPECTED_TABLES) {
    const row = found.get(name);
    if (!row) problems.push(`missing table "${name}"`);
    else if (!row.rls) problems.push(`RLS is off on "${name}"`);
    else if (row.policies < POLICIES_PER_TABLE) {
      problems.push(`"${name}" has only ${row.policies} policies`);
    }
  }
  return found.has('destinations');
}

async function checkContent(client, problems, log) {
  const { rows } = await client.query(
    `select d.name, d.province, d.category, d.cover_image_url,
            (select count(*)::int from public.destination_images i
              where i.destination_id = d.id) as images,
            (select count(*)::int from public.quiz_questions q
              where q.destination_id = d.id) as questions,
            (select count(*)::int from public.quiz_questions q
              where q.destination_id = d.id
                and (select count(*) from public.quiz_options o
                      where o.question_id = q.id) = $1
                and (select count(*) from public.quiz_options o
                      where o.question_id = q.id and o.is_correct) = 1) as sound_questions
       from public.destinations d
      order by d.province, d.name`,
    [OPTIONS_PER_QUESTION],
  );

  if (rows.length !== EXPECTED_COUNT) {
    problems.push(`${rows.length} destinations in the database (expected ${EXPECTED_COUNT})`);
  }

  const bucketMarker = `/storage/v1/object/public/${BUCKET}/`;
  for (const row of rows) {
    const at = (message) => problems.push(`${row.name}: ${message}`);
    if (!PROVINCES.includes(row.province)) at(`province "${row.province}" is not allowed`);
    if (!CATEGORIES.includes(row.category)) at(`category "${row.category}" is not allowed`);
    if (!row.cover_image_url) at('has no cover photo');
    else if (!row.cover_image_url.includes(bucketMarker)) at('cover photo is not in our bucket');
    if (row.images < 2) at(`has ${row.images} photo rows (expected at least 2)`);
    if (row.questions !== QUESTIONS_PER_DESTINATION) {
      at(`has ${row.questions} quiz questions (expected ${QUESTIONS_PER_DESTINATION})`);
    }
    if (row.sound_questions !== row.questions) {
      at(`${row.questions - row.sound_questions} question(s) lack ${OPTIONS_PER_QUESTION} options with exactly 1 correct`);
    }
  }

  // The database must hold exactly the destinations named in the dataset.
  let expectedNames = null;
  try {
    expectedNames = new Set(loadDataset({ validate: false }).destinations.map((d) => d.name));
  } catch {
    problems.push('data/destinations-seed.json could not be read');
  }
  if (expectedNames) {
    const actual = new Set(rows.map((row) => row.name));
    for (const name of expectedNames) if (!actual.has(name)) problems.push(`missing destination "${name}"`);
    for (const name of actual) if (!expectedNames.has(name)) problems.push(`unexpected destination "${name}"`);
  }

  const totals = await client.query(
    `select (select count(*)::int from public.destination_images) as images,
            (select count(*)::int from public.quiz_questions) as questions,
            (select count(*)::int from public.quiz_options) as options,
            (select count(*)::int from public.quiz_options where is_correct) as correct_options,
            (select count(*)::int from public.destinations
              where cover_image_url ilike '%picsum%') +
            (select count(*)::int from public.destination_images
              where image_url ilike '%picsum%') as placeholders`,
  );
  const total = totals.rows[0];
  if (total.placeholders > 0) problems.push(`${total.placeholders} placeholder photo URL(s) remain`);

  log(`\n  Destinations: ${rows.length}`);
  for (const province of PROVINCES) {
    const inProvince = rows.filter((row) => row.province === province);
    log(`    ${province.padEnd(9)} ${String(inProvince.length).padStart(2)}  ${inProvince.map((row) => row.name).join(' · ')}`);
  }
  log(
    `\n  Photos: ${total.images} (expected ${EXPECTED_COUNT * IMAGE_FILES.length})  ` +
      `Questions: ${total.questions} (expected ${EXPECTED_COUNT * QUESTIONS_PER_DESTINATION})  ` +
      `Options: ${total.options}, of which correct: ${total.correct_options}`,
  );
}

async function checkStorage(client, problems, log) {
  let storageReady = false;
  try {
    const bucket = await client.query('select id, public from storage.buckets where id = $1', [BUCKET]);
    const policies = await client.query(
      `select count(*)::int as count from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname like 'destination_images_anon_%'`,
    );
    const row = bucket.rows[0];
    log(
      `\n  Storage bucket "${BUCKET}": ${row ? (row.public ? 'public' : 'PRIVATE') : 'MISSING'}` +
        ` · policies: ${policies.rows[0].count}`,
    );
    storageReady = Boolean(row && row.public && policies.rows[0].count >= POLICIES_PER_TABLE);
  } catch (error) {
    log(`\n  Storage check failed: ${error.message}`);
  }
  if (!storageReady) problems.push(`storage bucket "${BUCKET}" is not fully set up`);
  return storageReady;
}

/** Fetches a few stored photo URLs to prove the public links really work. */
async function checkPhotoUrls(client, problems, log) {
  const { rows } = await client.query('select image_url from public.destination_images');
  const sample = pickRandom(rows.map((row) => row.image_url), URLS_TO_CHECK);
  log(`\n  Photo links (${sample.length} picked at random)`);
  for (const url of sample) {
    let outcome;
    try {
      const response = await fetch(url);
      const type = response.headers.get('content-type') || '';
      const bytes = (await response.arrayBuffer()).byteLength;
      outcome = `HTTP ${response.status}  ${type}  ${Math.round(bytes / 1024)} KB`;
      if (response.status !== 200 || !type.startsWith('image/')) {
        problems.push(`photo link is broken (${outcome}): ${url}`);
      }
    } catch (error) {
      outcome = `failed (${error.message})`;
      problems.push(`photo link could not be fetched: ${url}`);
    }
    log(`    ${outcome}  ${url.split(`/${BUCKET}/`)[1]}`);
  }
}

/** Runs every check and returns the list of problems (empty = all good). */
async function verifyDatabase(client, { log = console.log } = {}) {
  const problems = [];
  const hasDestinations = await checkTables(client, problems, log);
  if (hasDestinations) {
    await checkContent(client, problems, log);
    await checkPhotoUrls(client, problems, log);
  }
  await checkStorage(client, problems, log);
  return problems;
}

module.exports = { verifyDatabase };
