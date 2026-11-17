/**
 * Wikimedia Commons helpers shared by the image scripts.
 *
 * Commons is the ONLY place this project takes photos from, because every file
 * there carries machine-readable licence metadata. Nothing here talks to any
 * other image host.
 *
 * API docs: https://commons.wikimedia.org/w/api.php
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const API = 'https://commons.wikimedia.org/w/api.php';

/** Downloads are cached on disk so re-runs never ask Commons for the same file twice. */
const HTTP_CACHE_DIR = path.resolve(__dirname, '..', '..', '.cache', 'commons', 'http');

/** Pause between media downloads. Commons throttles bursts; this pace was never refused. */
const MEDIA_INTERVAL_MS = 10000;
/** How long to leave Commons alone after it answers "too many requests". */
const COOL_DOWN_MINUTES = 20;

/** Commons asks automated clients to identify themselves. */
const USER_AGENT =
  'calabarzon-heritage-tour-seed/1.0 (educational coursework project; Node.js fetch; ' +
  'downloads a small curated set of freely licensed photos)';

/** Width requested from Commons; the processing step then scales to 1600px. */
const DOWNLOAD_WIDTH = 1920;
const THUMB_WIDTH = 330;
/** The rendition widths Commons pre-computes; other sizes are discouraged. */
const STANDARD_WIDTHS = [1920, 1280, 960, 500, 330, 250];
const MIN_SOURCE_WIDTH = 1200;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Base wait when the API answers with a throttling notice instead of JSON. */
const API_BACKOFF_MS = 30000;
/** Pause between API calls, so listing a category never looks like a burst. */
const API_INTERVAL_MS = 1200;
let lastApiRequest = 0;

async function fetchWithRetry(url, { attempts = 6, binary = false } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (response.status === 429 || response.status >= 500) {
        // Do exactly what the server asks: wait out its Retry-After (plus a margin).
        const retryAfter = Number(response.headers.get('retry-after')) || 0;
        throw Object.assign(new Error(`HTTP ${response.status}`), {
          waitMs: Math.max((retryAfter + 5) * 1000, attempt * 5000),
        });
      }
      if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { fatal: true });
      if (binary) return Buffer.from(await response.arrayBuffer());

      // When the API is throttling it can answer 200 with a plain-text notice
      // ("You are making too many requests") instead of JSON. Back off hard.
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch {
        throw Object.assign(new Error(`not JSON: ${text.slice(0, 60)}`), {
          waitMs: API_BACKOFF_MS * attempt,
        });
      }
    } catch (error) {
      lastError = error;
      if (error.fatal || attempt === attempts) break;
      await sleep(error.waitMs || attempt * 1500);
    }
  }
  throw new Error(`Request failed (${lastError.message}): ${url}`);
}

async function api(params) {
  const query = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const wait = lastApiRequest + API_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);
  try {
    return await fetchWithRetry(`${API}?${query}`);
  } finally {
    lastApiRequest = Date.now();
  }
}

// ---------------------------------------------------------------------------
// Licences
// ---------------------------------------------------------------------------

/**
 * Accepts public domain, CC0, CC BY and CC BY-SA (any version / country port).
 * Rejects everything else — notably NC and ND variants and GFDL-only files.
 */
function isAcceptableLicense(shortName) {
  if (!shortName) return false;
  const name = shortName.trim();
  if (/\b(NC|ND)\b/i.test(name)) return false;
  return (
    /^public domain\b/i.test(name) ||
    /^PD\b/i.test(name) ||
    /^CC0\b/i.test(name) ||
    /^CC[ -]BY(-SA)?[ -]\d/i.test(name) ||
    /^No restrictions$/i.test(name)
  );
}

/** "CC BY-SA 4.0", "CC BY 2.0", "CC0", "Public domain". */
function tidyLicense(shortName) {
  const name = (shortName || '').trim();
  if (/^(public domain|PD\b|No restrictions)/i.test(name)) return 'Public domain';
  if (/^CC0/i.test(name)) return 'CC0';
  return name.replace(/^CC[ -]BY/i, 'CC BY').replace(/\s+/g, ' ');
}

// ---------------------------------------------------------------------------
// Authors
// ---------------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Turns Commons' HTML "Artist" field into a short plain-text credit. */
function tidyAuthor(artistHtml) {
  let author = stripHtml(artistHtml)
    .replace(/\(talk\)/gi, '')
    .replace(/\s*\(?\bUser:\s*/i, ' ')
    .replace(/^(photo(graph)?( taken)? by|by|author:?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  // Some uploaders write a paragraph; keep the credit short.
  if (author.length > 80) author = `${author.slice(0, 77).trim()}…`;
  return author || 'Unknown author';
}

// ---------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------

/**
 * The URL of a scaled rendition ("thumbnail") of a Commons file.
 *
 * IMPORTANT: always download a rendition, never the original upload. Commons
 * answers anonymous scripts that fetch original files with HTTP 429 every
 * time, while renditions at its standard widths are served normally. So we
 * ask for the largest standard width that is not wider than the wanted size
 * and still narrower than the original (Commons will not scale up).
 *
 * Renditions live at /thumb/<a>/<ab>/<name>/<width>px-<name>.
 */
function renditionUrl(originalUrl, originalWidth, wantedWidth) {
  // The API appends tracking parameters (?utm_source=…) to file URLs; drop them.
  const base = originalUrl.split('?')[0];
  const width = STANDARD_WIDTHS.find((step) => step <= wantedWidth && step < originalWidth);
  if (!width) return base;
  const name = base.split('/').pop();
  return `${base.replace('/commons/', '/commons/thumb/')}/${width}px-${name}`;
}

const IMAGE_PROPS = {
  prop: 'imageinfo',
  iiprop: 'url|size|mime|extmetadata',
  iiextmetadatafilter: 'LicenseShortName|LicenseUrl|Artist|ImageDescription|Restrictions',
};

function normalize(page) {
  const info = page.imageinfo && page.imageinfo[0];
  if (!info) return null;
  const meta = info.extmetadata || {};
  const value = (key) => (meta[key] && meta[key].value) || '';
  return {
    title: page.title, // "File:Example.jpg"
    pageUrl: info.descriptionurl,
    originalUrl: info.url,
    downloadUrl: renditionUrl(info.url, info.width, DOWNLOAD_WIDTH),
    width: info.width,
    height: info.height,
    mime: info.mime,
    license: tidyLicense(value('LicenseShortName')),
    rawLicense: value('LicenseShortName'),
    licenseUrl: value('LicenseUrl'),
    author: tidyAuthor(value('Artist')),
    description: stripHtml(value('ImageDescription')).slice(0, 200),
    restrictions: value('Restrictions'),
  };
}

/** Good enough to be a cover or gallery photo: a big, freely licensed JPEG. */
function isUsable(file) {
  return (
    file !== null &&
    file.mime === 'image/jpeg' &&
    file.width >= MIN_SOURCE_WIDTH &&
    isAcceptableLicense(file.rawLicense)
  );
}

async function collect(params, limit) {
  const files = [];
  let extra = {};
  while (files.length < limit) {
    const data = await api({ action: 'query', ...IMAGE_PROPS, ...params, ...extra });
    for (const page of (data.query && data.query.pages) || []) {
      const file = normalize(page);
      if (file) files.push(file);
    }
    if (!data.continue) break;
    extra = data.continue;
    await sleep(150);
  }
  return files;
}

/** Files directly inside a Commons category (name with or without "Category:"). */
function filesInCategory(category, limit = 200) {
  const title = category.startsWith('Category:') ? category : `Category:${category}`;
  return collect(
    { generator: 'categorymembers', gcmtitle: title, gcmtype: 'file', gcmlimit: '100' },
    limit,
  );
}

async function subcategories(category) {
  const title = category.startsWith('Category:') ? category : `Category:${category}`;
  const data = await api({
    action: 'query',
    list: 'categorymembers',
    cmtitle: title,
    cmtype: 'subcat',
    cmlimit: '50',
  });
  return ((data.query && data.query.categorymembers) || []).map((member) => member.title);
}

/** Full-text search over the File namespace. */
function searchFiles(term, limit = 40) {
  return collect(
    {
      generator: 'search',
      gsrsearch: `${term} filetype:bitmap`,
      gsrnamespace: '6',
      gsrlimit: '40',
    },
    limit,
  );
}

async function searchCategories(term, limit = 6) {
  const data = await api({
    action: 'query',
    list: 'search',
    srsearch: term,
    srnamespace: '14',
    srlimit: String(limit),
  });
  return ((data.query && data.query.search) || []).map((hit) => hit.title);
}

/** Metadata for specific files, e.g. ["File:A.jpg", "File:B.jpg"]. */
async function filesByTitle(titles) {
  const found = new Map();
  for (let index = 0; index < titles.length; index += 20) {
    const data = await api({
      action: 'query',
      ...IMAGE_PROPS,
      titles: titles.slice(index, index + 20).join('|'),
    });
    const renamed = new Map();
    for (const entry of (data.query && data.query.normalized) || []) {
      renamed.set(entry.to, entry.from);
    }
    for (const page of (data.query && data.query.pages) || []) {
      const file = normalize(page);
      if (file) found.set(renamed.get(page.title) || page.title, file);
    }
    await sleep(150);
  }
  return found;
}

/** A small rendition for contact sheets. */
function thumbUrl(file, width = THUMB_WIDTH) {
  return renditionUrl(file.originalUrl, file.width, width);
}

let lastMediaRequest = 0;

/** Thrown when Commons answers "too many requests"; callers must stop asking. */
class CommonsThrottledError extends Error {
  constructor(retryAfterSeconds) {
    super(
      'Wikimedia Commons is refusing downloads from this network right now (HTTP 429). ' +
        `Send it nothing for at least ${COOL_DOWN_MINUTES} minutes, then run the command again — ` +
        'photos already downloaded are kept, so it resumes where it stopped.',
    );
    this.name = 'CommonsThrottledError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/**
 * Downloads a media file politely: cached on disk, one request at a time with
 * a pause in between — and it STOPS at the first "too many requests" answer.
 *
 * What was learned the hard way while building the dataset:
 *   - Commons throttles by public IP, on its media host only (the API keeps
 *     working). The block is announced with HTTP 429 and `Retry-After: 120`.
 *   - Asking again after those two minutes does not help; a client that keeps
 *     polling just stays blocked. So there is deliberately no retry loop here.
 *   - Requesting an ORIGINAL upload instead of a rendition is what first
 *     triggered the block, which is why `renditionUrl()` never returns one for
 *     a photo-sized file.
 */
async function download(url) {
  const cacheFile = path.join(
    HTTP_CACHE_DIR,
    crypto.createHash('sha1').update(url).digest('hex'),
  );
  if (fs.existsSync(cacheFile)) return fs.readFileSync(cacheFile);

  const wait = lastMediaRequest + MEDIA_INTERVAL_MS - Date.now();
  if (wait > 0) await sleep(wait);

  let response;
  try {
    response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  } finally {
    lastMediaRequest = Date.now();
  }

  if (response.status === 429) {
    throw new CommonsThrottledError(Number(response.headers.get('retry-after')) || 120);
  }
  if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}): ${url}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(HTTP_CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, buffer);
  return buffer;
}

module.exports = {
  CommonsThrottledError,
  DOWNLOAD_WIDTH,
  MIN_SOURCE_WIDTH,
  USER_AGENT,
  download,
  filesByTitle,
  filesInCategory,
  isAcceptableLicense,
  isUsable,
  searchCategories,
  searchFiles,
  sleep,
  subcategories,
  thumbUrl,
  tidyAuthor,
  tidyLicense,
};
