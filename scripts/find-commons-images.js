#!/usr/bin/env node
/**
 * Photo curation helper: lists freely licensed Wikimedia Commons photos for a
 * place and builds a numbered contact sheet, so a person can pick the cover
 * and gallery shots by eye.
 *
 *   node scripts/find-commons-images.js <name> [--cat "Commons category"]...
 *        [--search "search words"]... [--max 24] [--page 2] [--deep]
 *        [--match "regex on title/description"]
 *
 *   node scripts/find-commons-images.js rizal-shrine --cat "Rizal Shrine (Calamba)"
 *   node scripts/find-commons-images.js daranak --search "Daranak Falls Tanay"
 *   node scripts/find-commons-images.js x --find-cat "Taal Basilica"   (list categories only)
 *
 * Output goes to .cache/commons/<name>.jpg (sheet) and <name>.json (metadata).
 * Only files that pass the licence / size rules in scripts/lib/commons.js are
 * shown. Chosen files are then recorded by title in data/destinations-seed.json
 * and fetched by scripts/fetch-images.js.
 */

const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const commons = require('./lib/commons');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, '.cache', 'commons');

const COLUMNS = 4;
const CELL_WIDTH = 330;
const CELL_HEIGHT = 220;
const LABEL_HEIGHT = 26;
const GAP = 8;
const PER_AUTHOR_PER_PASS = 4;

function parseArgs(argv) {
  const options = { name: null, cats: [], searches: [], findCats: [], max: 24, page: 1, deep: false, match: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--cat') options.cats.push(argv[++index]);
    else if (arg === '--search') options.searches.push(argv[++index]);
    else if (arg === '--find-cat') options.findCats.push(argv[++index]);
    else if (arg === '--max') options.max = Number(argv[++index]);
    else if (arg === '--page') options.page = Number(argv[++index]);
    else if (arg === '--match') options.match = new RegExp(argv[++index], 'i');
    else if (arg === '--deep') options.deep = true;
    else if (!options.name) options.name = arg;
  }
  return options;
}

/** Landscape first (covers need it), then the larger originals. */
function rank(a, b) {
  const landscape = (file) => (file.width / file.height >= 1.2 ? 1 : 0);
  return landscape(b) - landscape(a) || b.width - a.width;
}

function label(text, width) {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${LABEL_HEIGHT}">
       <rect width="100%" height="100%" fill="#2A2420"/>
       <text x="6" y="18" font-family="Arial, sans-serif" font-size="14" fill="#fff">${safe}</text>
     </svg>`,
  );
}

async function buildSheet(files, outFile) {
  const rows = Math.ceil(files.length / COLUMNS);
  const width = COLUMNS * CELL_WIDTH + (COLUMNS + 1) * GAP;
  const rowHeight = CELL_HEIGHT + LABEL_HEIGHT + GAP;
  const height = rows * rowHeight + GAP;

  const layers = [];
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const left = GAP + (index % COLUMNS) * (CELL_WIDTH + GAP);
    const top = GAP + Math.floor(index / COLUMNS) * rowHeight;
    try {
      const url = commons.thumbUrl(file);
      if (!url) throw new Error('no rendition');
      const thumb = await commons.download(url);
      const cell = await sharp(thumb)
        .resize(CELL_WIDTH, CELL_HEIGHT, { fit: 'contain', background: '#dddddd' })
        .jpeg()
        .toBuffer();
      layers.push({ input: cell, left, top });
    } catch (error) {
      // If Commons is throttling, stop: asking for more thumbnails only prolongs it.
      if (error instanceof commons.CommonsThrottledError) throw error;
      console.log(`  (thumbnail ${index + 1} failed: ${error.message})`);
    }
    layers.push({
      input: label(`#${index + 1}  ${file.width}x${file.height}  ${file.license}`, CELL_WIDTH),
      left,
      top: top + CELL_HEIGHT,
    });
  }

  await sharp({ create: { width, height, channels: 3, background: '#ffffff' } })
    .composite(layers)
    .jpeg({ quality: 82 })
    .toFile(outFile);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  for (const term of options.findCats) {
    console.log(`Categories matching "${term}":`);
    for (const title of await commons.searchCategories(term)) console.log(`  ${title}`);
  }
  if (!options.name || (options.cats.length === 0 && options.searches.length === 0)) {
    if (options.findCats.length === 0) {
      console.log('Usage: node scripts/find-commons-images.js <name> --cat "..." --search "..."');
    }
    return;
  }

  const seen = new Map();
  const add = (files, origin) => {
    for (const file of files) {
      if (commons.isUsable(file) && !seen.has(file.title)) seen.set(file.title, { ...file, origin });
    }
  };

  for (const category of options.cats) {
    add(await commons.filesInCategory(category), category);
    if (options.deep) {
      for (const sub of (await commons.subcategories(category)).slice(0, 12)) {
        add(await commons.filesInCategory(sub, 60), sub);
      }
    }
  }
  for (const term of options.searches) add(await commons.searchFiles(term), `search: ${term}`);

  const matching = [...seen.values()].filter(
    (file) => !options.match || options.match.test(`${file.title} ${file.description}`),
  );
  // Prolific uploaders can fill a whole sheet with near-identical shots, so
  // each author gets a few slots per pass before the others are considered.
  const ranked = matching.sort(rank);
  const ordered = [];
  for (let pass = 0; ordered.length < ranked.length; pass += 1) {
    const perAuthor = new Map();
    for (const file of ranked) {
      if (ordered.includes(file)) continue;
      const used = perAuthor.get(file.author) || 0;
      if (used >= PER_AUTHOR_PER_PASS) continue;
      perAuthor.set(file.author, used + 1);
      ordered.push(file);
    }
    if (pass > ranked.length) break;
  }

  const start = (options.page - 1) * options.max;
  const files = ordered.slice(start, start + options.max);
  if (files.length === 0) {
    console.log(`${options.name}: no usable files found.`);
    return;
  }

  await commons.resolveRenditions(files);

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const suffix = options.page > 1 ? `-p${options.page}` : '';
  const sheet = path.join(OUT_DIR, `${options.name}${suffix}.jpg`);
  await buildSheet(files, sheet);
  fs.writeFileSync(
    path.join(OUT_DIR, `${options.name}${suffix}.json`),
    JSON.stringify(files, null, 2),
  );

  console.log(`${options.name}: ${files.length} of ${matching.length} usable files → ${sheet}`);
  files.forEach((file, index) => {
    console.log(
      `  #${String(index + 1).padStart(2)} ${file.width}x${file.height} ${file.license.padEnd(13)} ` +
        `${file.title} — ${file.author}`,
    );
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
