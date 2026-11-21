#!/usr/bin/env node
/**
 * Build-time panorama curation (Run 8).
 *
 *   npx tsx scripts/curate-panoramas.mjs [--dry-run] [--shots <dir>]
 *
 * Loads the Maps Embed API Street View page for each of the dataset's
 * destinations in headless Chromium (the same URL the app's 360° step
 * loads) and decides whether a real panorama renders or Google's
 * "no imagery" state appears (src/lib/panorama.ts: place card present and
 * the frame not all black). Writes `has_panorama` into
 * data/destinations-seed.json plus a `panorama_curation` note. It never
 * touches the database — `npm run db:sync-panoramas` copies the flags to the
 * live rows by stable id (no reset).
 *
 * Needs EXPO_PUBLIC_MAPS_EMBED_KEY in .env and Playwright
 * (PLAYWRIGHT_MODULE / PLAYWRIGHT_CHROMIUM as for web-clickthrough.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { PLACE_CARD_PROBE, classifyEmbedProbe, panoramaEmbedUrl, panoramaHtml, validateCuration } from '../src/lib/panorama.ts';

const require = createRequire(import.meta.url);
const { readEnvFile } = require('./lib/env');
const { DATASET_PATH } = require('./lib/dataset');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const sharp = require('sharp');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const shotsIndex = args.indexOf('--shots');
const shotsDir = shotsIndex >= 0 ? args[shotsIndex + 1] : null;

const env = { ...readEnvFile(), ...process.env };
const key = (env.EXPO_PUBLIC_MAPS_EMBED_KEY || '').trim();
if (!key) {
  console.error('EXPO_PUBLIC_MAPS_EMBED_KEY is missing from .env');
  process.exit(1);
}

const raw = fs.readFileSync(DATASET_PATH, 'utf8');
const dataset = JSON.parse(raw);

async function darkRatio(page) {
  const png = await page.screenshot();
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let dark = 0;
  const pixels = info.width * info.height;
  for (let i = 0; i < data.length; i += 3) if (data[i] + data[i + 1] + data[i + 2] < 45) dark += 1;
  return { ratio: dark / pixels, png };
}

async function main() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  const context = await browser.newContext({ viewport: { width: 640, height: 420 }, locale: 'en-US' });
  const page = await context.newPage();
  if (shotsDir) fs.mkdirSync(shotsDir, { recursive: true });

  const rows = [];
  for (const destination of dataset.destinations) {
    const url = panoramaEmbedUrl(destination, key);
    let probe = { hasPlaceCard: false, text: '' };
    let ratio = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      // The Embed API only renders inside an iframe — the same wrapper page the app's WebView loads.
      await page.setContent(panoramaHtml(url, '#1c1714', destination.name), { waitUntil: 'load', timeout: 30000 });
      // The panorama tiles and the place card arrive after load.
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        const frame = page.frames().find((candidate) => candidate.url().includes('/maps/embed/'));
        if (frame) probe = await frame.evaluate(PLACE_CARD_PROBE).catch(() => probe);
        if (probe.hasPlaceCard) break;
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(2500);
      let sample = await darkRatio(page);
      // A place card over a still-black frame: the tiles may just be slow — resample before deciding.
      for (let wait = 0; wait < 3 && probe.hasPlaceCard && sample.ratio > 0.9; wait += 1) {
        await page.waitForTimeout(5000);
        sample = await darkRatio(page);
      }
      ratio = sample.ratio;
      if (shotsDir) fs.writeFileSync(path.join(shotsDir, `${destination.slug}.png`), sample.png);
      if (probe.hasPlaceCard) break;
    }
    const has = classifyEmbedProbe({ hasPlaceCard: probe.hasPlaceCard, darkRatio: ratio, text: probe.text });
    const label = probe.hasPlaceCard ? probe.text.split('\n')[0].trim() || null : null;
    rows.push({ slug: destination.slug, name: destination.name, province: destination.province, has_panorama: has, place_label: label });
    console.log(`${has ? 'PANO ' : 'none '} ${destination.slug.padEnd(48)} dark=${ratio?.toFixed(2)} ${label ?? ''}`);
  }
  await browser.close();

  const problems = validateCuration(rows, dataset.destinations.map((d) => d.slug));
  if (problems.length > 0) throw new Error(`curation output invalid: ${problems.join('; ')}`);

  const yes = rows.filter((row) => row.has_panorama).length;
  console.log(`\n${yes} of ${rows.length} destinations have a panorama within the embed radius.`);
  fs.writeFileSync(path.join(path.dirname(DATASET_PATH), 'panorama-curation.json'), `${JSON.stringify(rows, null, 2)}\n`);

  if (dryRun) {
    console.log('Dry run: dataset not changed.');
    return;
  }
  const bySlug = new Map(rows.map((row) => [row.slug, row.has_panorama]));
  dataset.panorama_curation = {
    checked_on: new Date().toISOString().slice(0, 10),
    method:
      'Maps Embed API streetview (radius 250 m, fov 90) loaded in headless Chromium; has_panorama = Google place card shown and frame not all black (scripts/curate-panoramas.mjs).',
  };
  // Insert has_panorama right after the coordinates, keeping every other key in place.
  dataset.destinations = dataset.destinations.map((destination) => {
    const next = {};
    for (const [field, value] of Object.entries(destination)) {
      if (field === 'has_panorama') continue;
      next[field] = value;
      if (field === 'coordinate_source') next.has_panorama = bySlug.get(destination.slug);
    }
    return next;
  });
  fs.writeFileSync(DATASET_PATH, `${JSON.stringify(dataset, null, 2)}\n`);
  console.log('Wrote has_panorama into data/destinations-seed.json.');
}

main().catch((error) => {
  console.error(`Curation failed: ${error.message}`);
  process.exit(1);
});
