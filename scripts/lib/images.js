/**
 * Photo processing for the dataset.
 *
 * Each photo named in data/destinations-seed.json is downloaded once from
 * Wikimedia Commons, scaled to at most 1600px, saved as a JPEG of roughly
 * 150–400 KB in data/images/<slug>/, and committed. Seeding then uploads those
 * local files, so a database reset never depends on Commons being reachable.
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const commons = require('./commons');
const { imagePaths } = require('./dataset');
const { ROOT } = require('./env');

const CREDITS_PATH = path.join(ROOT, 'data', 'IMAGE_CREDITS.md');

const MAX_DIMENSION = 1600;
const TARGET_MAX_BYTES = 400 * 1024;
const TARGET_MIN_BYTES = 150 * 1024;
/** Hard ceiling: the bucket allows 5 MB, but uploads must stay well under 1 MB. */
const HARD_MAX_BYTES = 700 * 1024;
const QUALITY_START = 82;
const QUALITY_MIN = 58;
const QUALITY_MAX = 92;
const QUALITY_STEP = 4;

function encode(pipeline, quality) {
  return pipeline
    .clone()
    .jpeg({ quality, mozjpeg: true, progressive: true, chromaSubsampling: '4:2:0' })
    .toBuffer();
}

/**
 * Resizes and compresses one source photo. Quality is walked down until the
 * file fits the target, or up a little when a simple image comes out tiny.
 */
async function processPhoto(source) {
  const pipeline = sharp(source, { failOn: 'none' })
    .rotate() // apply EXIF orientation, then drop the metadata
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .toColourspace('srgb');

  let quality = QUALITY_START;
  let output = await encode(pipeline, quality);

  while (output.length > TARGET_MAX_BYTES && quality > QUALITY_MIN) {
    quality -= QUALITY_STEP;
    output = await encode(pipeline, quality);
  }
  while (output.length < TARGET_MIN_BYTES && quality < QUALITY_MAX) {
    const next = await encode(pipeline, quality + QUALITY_STEP);
    if (next.length > TARGET_MAX_BYTES) break;
    quality += QUALITY_STEP;
    output = next;
  }
  if (output.length > HARD_MAX_BYTES) {
    throw new Error(`still ${Math.round(output.length / 1024)} KB at quality ${quality}`);
  }

  const { width, height } = await sharp(output).metadata();
  return { buffer: output, width, height, quality };
}

/** Short content hash, used as a cache-busting `?v=` on the public URL. */
function contentVersion(buffer) {
  return crypto.createHash('sha1').update(buffer).digest('hex').slice(0, 10);
}

/**
 * Makes sure every photo in the dataset exists in data/images. Missing ones
 * (or all of them with `force`) are fetched from Commons and processed.
 * Returns one record per photo. With `keepGoing`, a photo that cannot be fetched
 * is reported in `.failures` instead of stopping the run.
 */
async function ensureImages(
  dataset,
  { force = false, only = null, keepGoing = false, log = console.log } = {},
) {
  const wanted = [];
  for (const destination of dataset.destinations) {
    if (only && !only.includes(destination.slug)) continue;
    for (const image of destination.images) {
      wanted.push({ destination, image, ...imagePaths(destination, image) });
    }
  }

  // Covers first, so every destination gets its main photo before any gallery shot.
  const missing = wanted
    .filter((item) => force || !fs.existsSync(item.local))
    .sort((x, y) => x.destination.images.indexOf(x.image) - y.destination.images.indexOf(y.image));
  const failures = [];
  if (missing.length > 0) {
    log(`  fetching ${missing.length} photo(s) from Wikimedia Commons, one every few seconds`);
    const info = await commons.filesByTitle(missing.map((item) => item.image.commons_title));

    for (const item of missing) {
      const label = `${item.destination.slug}/${item.image.file}`;
      try {
        const file = info.get(item.image.commons_title);
        if (!file) throw new Error(`"${item.image.commons_title}" was not found on Commons`);
        if (!commons.isAcceptableLicense(file.rawLicense)) {
          throw new Error(`licence is now "${file.rawLicense}", which is not accepted`);
        }
        if (!file.downloadUrl) {
          throw new Error('Commons offers no scaled rendition of this file (the original is too small)');
        }
        const source = await commons.download(file.downloadUrl);
        const processed = await processPhoto(source);
        fs.mkdirSync(path.dirname(item.local), { recursive: true });
        fs.writeFileSync(item.local, processed.buffer);
        log(
          `    ${label.padEnd(46)} ${processed.width}x${processed.height} ` +
            `${String(Math.round(processed.buffer.length / 1024)).padStart(4)} KB  q${processed.quality}`,
        );
      } catch (error) {
        // A throttled client must stop asking altogether, not move on to the next file.
        const throttled = error instanceof commons.CommonsThrottledError;
        if (!keepGoing) throw throttled ? error : new Error(`${label}: ${error.message}`);
        failures.push(`${label}: ${error.message}`);
        log(`    ${label.padEnd(46)} FAILED — ${throttled ? 'Commons is throttling; stopping here' : error.message}`);
        if (throttled) {
          log(`  ${error.message}`);
          break;
        }
      }
    }
  }
  if (failures.length > 0) log(`  ${failures.length} photo(s) could not be fetched`);

  const ready = wanted.filter((item) => fs.existsSync(item.local));
  const photos = await Promise.all(
    ready.map(async (item) => {
      const buffer = fs.readFileSync(item.local);
      const { width, height } = await sharp(buffer).metadata();
      return { ...item, buffer, width, height, bytes: buffer.length, version: contentVersion(buffer) };
    }),
  );
  photos.failures = failures;
  return photos;
}

/**
 * Writes data/IMAGE_CREDITS.md: the author, licence and source page of every
 * photo. The licences (CC BY, CC BY-SA) require this credit to travel with
 * the files, and the file doubles as a review list.
 */
function writeImageCredits(dataset) {
  const lines = [
    '# Photo credits',
    '',
    'Every photo in `data/images/` comes from [Wikimedia Commons](https://commons.wikimedia.org)',
    'and is in the public domain or under a Creative Commons licence (CC0, CC BY or CC BY-SA).',
    'Each file was resized to at most 1600px and re-compressed as JPEG; no other changes were made.',
    'Photos under CC BY-SA remain under that same licence in their resized form.',
    '',
    'This file is generated from `data/destinations-seed.json` — edit that, not this.',
    '',
  ];
  for (const destination of dataset.destinations) {
    lines.push(
      `## ${destination.name}`,
      '',
      '| File | Author | Licence | Source |',
      '| --- | --- | --- | --- |',
    );
    for (const image of destination.images) {
      const licence = image.license_url
        ? `[${image.license}](${image.license_url})`
        : image.license;
      const author = String(image.author).replace(/\|/g, '/');
      lines.push(
        `| \`${destination.slug}/${image.file}\` | ${author} | ${licence} | [Commons page](${image.source_url}) |`,
      );
    }
    lines.push('');
  }
  fs.writeFileSync(CREDITS_PATH, lines.join('\n'));
}

module.exports = {
  HARD_MAX_BYTES,
  MAX_DIMENSION,
  TARGET_MAX_BYTES,
  TARGET_MIN_BYTES,
  contentVersion,
  ensureImages,
  processPhoto,
  writeImageCredits,
};
