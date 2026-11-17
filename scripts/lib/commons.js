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

/** Pause between media downloads — a courtesy; renditions were never refused at this pace. */
const MEDIA_INTERVAL_MS = 3000;

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
 * How photos are downloaded — this cost hours to learn, so read it.
 *
 * Commons has two media hosts:
 *   - thumb.wikimedia.org serves scaled renditions ("thumbnails"). Scripts may
 *     fetch these.
 *   - upload.wikimedia.org serves the original uploads. It answers scripts
 *     with HTTP 429 "Too many requests" every single time — it is not a
 *     temporary rate limit, and waiting or retrying never helps.
 *
 * The API tells us the right address: with `iiurlwidth`, `imageinfo` returns a
 * `thumburl` on thumb.wikimedia.org. We use that URL as given and never build
 * media URLs by hand (a hand-built path lands on the upload host and is
 * refused). If the original is narrower than the width asked for, the API
 * returns the original instead, so we ask again for a narrower standard width.
 */

/** True when the API gave us a scaled rendition rather than the original file. */
function isRenditionUrl(url) {
  return typeof url === 'string' && /\/thumb\//.test(url) && /\/\d+px-/.test(url);
}

const IMAGE_PROPS = {
  prop: 'imageinfo',
  iiprop: 'url|size|mime|extmetadata',
  iiurlwidth: String(DOWNLOAD_WIDTH),
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
    // Null when the original is narrower than DOWNLOAD_WIDTH; see resolveRenditions().
    downloadUrl: isRenditionUrl(info.thumburl) ? info.thumburl : null,
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
  await resolveRenditions([...found.values()]);
  return found;
}

/**
 * A small rendition for contact sheets: the API's own rendition URL with only
 * the width changed. Returns null when no rendition is known for the file.
 */
function thumbUrl(file, width = THUMB_WIDTH) {
  if (!file.downloadUrl) return null;
  return file.downloadUrl.replace(/\/\d+px-/, `/${width}px-`);
}

/**
 * Fills in `downloadUrl` for files whose original is narrower than
 * DOWNLOAD_WIDTH by asking the API for the next standard width down.
 */
async function resolveRenditions(files) {
  for (const width of STANDARD_WIDTHS.filter((step) => step < DOWNLOAD_WIDTH && step >= 960)) {
    const pending = files.filter((file) => !file.downloadUrl && file.width > width);
    for (let index = 0; index < pending.length; index += 20) {
      const batch = pending.slice(index, index + 20);
      const data = await api({
        action: 'query',
        prop: 'imageinfo',
        iiprop: 'url',
        iiurlwidth: String(width),
        titles: batch.map((file) => file.title).join('|'),
      });
      for (const page of (data.query && data.query.pages) || []) {
        const url = page.imageinfo && page.imageinfo[0] && page.imageinfo[0].thumburl;
        const file = batch.find((item) => item.title === page.title);
        if (file && isRenditionUrl(url)) file.downloadUrl = url;
      }
    }
  }
  return files;
}

let lastMediaRequest = 0;

/** Thrown when Commons answers "too many requests"; callers must stop asking. */
class CommonsThrottledError extends Error {
  constructor(url) {
    super(
      'Wikimedia Commons refused the download (HTTP 429). ' +
        (String(url).includes('//upload.wikimedia.org/')
          ? 'The URL is on upload.wikimedia.org, which never serves scripts — use the rendition URL the API returns (thumb.wikimedia.org).'
          : 'Stop sending requests, wait a while, then run the command again; photos already downloaded are kept.'),
    );
    this.name = 'CommonsThrottledError';
  }
}

/**
 * Downloads a media file politely: cached on disk, one request at a time with
 * a pause in between — and it STOPS at the first "too many requests" answer
 * instead of retrying, because retrying a refused URL never succeeds.
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
    throw new CommonsThrottledError(url);
  }
  if (!response.ok) throw new Error(`Download failed (HTTP ${response.status}): ${url}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(HTTP_CACHE_DIR, { recursive: true });
  fs.writeFileSync(cacheFile, buffer);
  return buffer;
}

module.exports = {
  CommonsThrottledError,
  resolveRenditions,
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
