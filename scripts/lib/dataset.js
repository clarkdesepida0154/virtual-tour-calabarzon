/**
 * Loads and validates data/destinations-seed.json — the single source of truth
 * for the app's content (destinations, photos, quizzes).
 *
 * Every script that touches the content goes through `loadDataset()`, so a
 * broken edit to the JSON is caught before anything reaches the database.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { isAcceptableLicense } = require('./commons');
const { ROOT } = require('./env');

const DATASET_PATH = path.join(ROOT, 'data', 'destinations-seed.json');
const IMAGES_DIR = path.join(ROOT, 'data', 'images');
const BUCKET = 'destination-images';

const EXPECTED_COUNT = 26;
const QUESTIONS_PER_DESTINATION = 5;
const OPTIONS_PER_QUESTION = 4;
const IMAGE_FILES = ['cover.jpg', 'gallery-1.jpg', 'gallery-2.jpg'];

/** Must match the CHECK constraints in supabase/schema.sql and src/constants/taxonomy.ts. */
const PROVINCES = ['Cavite', 'Laguna', 'Batangas', 'Rizal', 'Quezon'];
const CATEGORIES = [
  'Historical Site',
  'Church & Religious',
  'Museum & Art',
  'Natural Wonder',
  'Heritage Town & Culture',
];

/**
 * Generous boxes around each province [south, north, west, east]. They catch
 * swapped or mistyped coordinates; they are not survey-grade boundaries.
 */
const PROVINCE_BOUNDS = {
  Cavite: [14.0, 14.55, 120.5, 121.1],
  Laguna: [13.95, 14.6, 120.95, 121.7],
  Batangas: [13.45, 14.2, 120.45, 121.55],
  Rizal: [14.3, 14.9, 121.05, 121.5],
  Quezon: [13.1, 15.45, 121.2, 122.75],
};

const WORD_LIMITS = {
  history: [120, 200],
  cultural_significance: [80, 150],
};

const CAPTION_PATTERN = /^Photo: .+, .+, via Wikimedia Commons$/;

const wordCount = (text) => String(text || '').trim().split(/\s+/).filter(Boolean).length;
/** Counts sentences, ignoring abbreviations ("St.", "Km.", "Fr.") and initials ("J. P."). */
function sentenceCount(text) {
  const cleaned = String(text || '')
    .replace(/\b(St|Sta|Sto|Fr|Dr|Mt|Km|Brgy|Gen|Msgr|No|Jr|Sr|Mr|Mrs|Ave|ca)\./gi, '$1')
    .replace(/\b([A-Z])\./g, '$1');
  return (cleaned.match(/[.!?]["')\]]?(\s|$)/g) || []).length;
}

// ---------------------------------------------------------------------------
// Stable ids
// ---------------------------------------------------------------------------

/** Namespace for this project's UUIDv5 ids (an arbitrary, fixed UUID). */
const ID_NAMESPACE = '6f1d2c4e-8a3b-4f6d-9c1e-7b5a2d8e4f10';

/**
 * Deterministic UUID (v5) from a readable key such as "rizal-shrine" or
 * "rizal-shrine/q3". Re-seeding therefore keeps every id — and every deep link
 * — the same.
 */
function stableId(key) {
  const namespace = Buffer.from(ID_NAMESPACE.replace(/-/g, ''), 'hex');
  const hash = crypto.createHash('sha1').update(namespace).update(key).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50; // version 5
  hash[8] = (hash[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateDestination(destination, problems) {
  const at = (message) => problems.push(`${destination.slug || destination.name || '?'}: ${message}`);

  for (const field of ['slug', 'name', 'description', 'history', 'cultural_significance', 'address', 'municipality']) {
    if (typeof destination[field] !== 'string' || !destination[field].trim()) at(`missing ${field}`);
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(destination.slug || '')) at('slug must be kebab-case');
  if (!PROVINCES.includes(destination.province)) at(`invalid province "${destination.province}"`);
  if (!CATEGORIES.includes(destination.category)) at(`invalid category "${destination.category}"`);

  for (const [field, [min, max]] of Object.entries(WORD_LIMITS)) {
    const words = wordCount(destination[field]);
    if (words < min || words > max) at(`${field} has ${words} words (expected ${min}–${max})`);
  }
  const sentences = sentenceCount(destination.description);
  if (sentences < 2 || sentences > 3) at(`description has ${sentences} sentences (expected 2–3)`);

  const { latitude, longitude } = destination;
  const bounds = PROVINCE_BOUNDS[destination.province];
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    at('latitude and longitude must be numbers');
  } else if (bounds) {
    const [south, north, west, east] = bounds;
    if (latitude < south || latitude > north || longitude < west || longitude > east) {
      at(`coordinates ${latitude}, ${longitude} fall outside ${destination.province}`);
    }
  }

  // Photos: one cover and two gallery shots, all freely licensed and credited.
  const images = destination.images || [];
  if (images.length !== IMAGE_FILES.length) at(`has ${images.length} images (expected ${IMAGE_FILES.length})`);
  IMAGE_FILES.forEach((file, index) => {
    const image = images[index];
    if (!image) return;
    if (image.file !== file) at(`image ${index + 1} should be ${file}, found ${image.file}`);
    if (image.role !== (index === 0 ? 'cover' : 'gallery')) at(`${file} has the wrong role`);
    if (!/^File:.+/.test(image.commons_title || '')) at(`${file} is missing its Commons title`);
    if (!/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/.test(image.source_url || '')) {
      at(`${file} must link to its Wikimedia Commons page`);
    }
    if (!isAcceptableLicense(image.license)) at(`${file} has an unaccepted licence "${image.license}"`);
    if (!CAPTION_PATTERN.test(image.caption || '')) at(`${file} caption is not in the credit format`);
  });
  const titles = images.map((image) => image.commons_title);
  if (new Set(titles).size !== titles.length) at('uses the same photo twice');

  // Quiz: five questions, four distinct options, exactly one correct.
  const quiz = destination.quiz || [];
  if (quiz.length !== QUESTIONS_PER_DESTINATION) {
    at(`has ${quiz.length} quiz questions (expected ${QUESTIONS_PER_DESTINATION})`);
  }
  quiz.forEach((item, index) => {
    const label = `question ${index + 1}`;
    if (typeof item.question !== 'string' || !item.question.trim().endsWith('?')) {
      at(`${label} must be a question ending in "?"`);
    }
    const options = item.options || [];
    if (options.length !== OPTIONS_PER_QUESTION) at(`${label} has ${options.length} options`);
    if (options.filter((option) => option.correct === true).length !== 1) {
      at(`${label} must have exactly one correct option`);
    }
    const texts = options.map((option) => String(option.text || '').trim().toLowerCase());
    if (texts.some((text) => !text)) at(`${label} has an empty option`);
    if (new Set(texts).size !== texts.length) at(`${label} has duplicate options`);
  });
  const questions = quiz.map((item) => String(item.question || '').trim().toLowerCase());
  if (new Set(questions).size !== questions.length) at('has duplicate quiz questions');
}

function validateDataset(dataset) {
  const problems = [];
  const destinations = dataset.destinations || [];

  if (destinations.length !== EXPECTED_COUNT) {
    problems.push(`dataset has ${destinations.length} destinations (expected ${EXPECTED_COUNT})`);
  }
  for (const key of ['slug', 'name']) {
    const seen = new Set();
    for (const destination of destinations) {
      if (seen.has(destination[key])) problems.push(`duplicate ${key} "${destination[key]}"`);
      seen.add(destination[key]);
    }
  }
  for (const destination of destinations) validateDestination(destination, problems);
  return problems;
}

/** Reads the dataset and throws, listing every problem, if it is not valid. */
function loadDataset({ validate = true } = {}) {
  if (!fs.existsSync(DATASET_PATH)) {
    throw new Error(`Dataset not found at ${path.relative(ROOT, DATASET_PATH)}`);
  }
  const dataset = JSON.parse(fs.readFileSync(DATASET_PATH, 'utf8'));
  if (validate) {
    const problems = validateDataset(dataset);
    if (problems.length > 0) {
      throw new Error(`data/destinations-seed.json is not valid:\n  - ${problems.join('\n  - ')}`);
    }
  }
  return dataset;
}

/** Where a processed photo lives on disk and in the storage bucket. */
function imagePaths(destination, image) {
  return {
    local: path.join(IMAGES_DIR, destination.slug, image.file),
    storage: `${destination.slug}/${image.file}`,
  };
}

module.exports = {
  BUCKET,
  CATEGORIES,
  DATASET_PATH,
  EXPECTED_COUNT,
  IMAGES_DIR,
  IMAGE_FILES,
  OPTIONS_PER_QUESTION,
  PROVINCES,
  PROVINCE_BOUNDS,
  QUESTIONS_PER_DESTINATION,
  WORD_LIMITS,
  imagePaths,
  loadDataset,
  stableId,
  validateDataset,
  wordCount,
};
