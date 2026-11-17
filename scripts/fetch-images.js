#!/usr/bin/env node
/**
 * Downloads and processes the photos named in data/destinations-seed.json.
 *
 *   npm run images:fetch                  only the photos missing from data/images
 *   npm run images:fetch -- --force       re-download and re-process everything
 *   npm run images:fetch -- rizal-shrine  just these destinations (add --force to redo them)
 *   npm run images:fetch -- --keep-going  skip photos that fail instead of stopping
 *
 * Source: Wikimedia Commons only. Each file's licence is re-checked at
 * download time, the photo is scaled to at most 1600px and saved as a JPEG of
 * roughly 150–400 KB, and data/IMAGE_CREDITS.md is rewritten.
 *
 * Seeding (npm run db:seed) calls the same code for any photo that is missing,
 * so this script is only needed after changing which photos the dataset uses.
 */

const { loadDataset } = require('./lib/dataset');
const { ensureImages, writeImageCredits } = require('./lib/images');

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const keepGoing = args.includes('--keep-going');
  const only = args.filter((arg) => !arg.startsWith('--'));

  // --keep-going is for curation: work with a dataset that is still being assembled.
  const dataset = loadDataset({ validate: !keepGoing });
  const unknown = only.filter((slug) => !dataset.destinations.some((d) => d.slug === slug));
  if (unknown.length > 0) throw new Error(`Unknown destination slug(s): ${unknown.join(', ')}`);

  console.log('Preparing photos');
  const photos = await ensureImages(dataset, {
    force,
    keepGoing,
    only: only.length > 0 ? only : null,
  });
  if (!keepGoing) writeImageCredits(dataset);
  if (photos.length === 0) throw new Error('No photos are ready.');

  const sizes = photos.map((photo) => photo.bytes);
  const kb = (bytes) => `${Math.round(bytes / 1024)} KB`;
  console.log(
    `\n${photos.length} photo(s) ready · smallest ${kb(Math.min(...sizes))} · largest ${kb(Math.max(...sizes))} · ` +
      `total ${(sizes.reduce((a, b) => a + b, 0) / 1024 / 1024).toFixed(1)} MB`,
  );
  if (!keepGoing) console.log('Credits written to data/IMAGE_CREDITS.md');
  if (photos.failures.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
