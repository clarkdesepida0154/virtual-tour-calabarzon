#!/usr/bin/env node
/**
 * Photo top-up WITHOUT a reset.
 *
 *   npm run db:sync-photos
 *
 * After photos are replaced in data/destinations-seed.json and processed into
 * data/images (npm run images:fetch -- <slug> --force), this:
 *   1. uploads every dataset photo to Storage (overwriting in place);
 *   2. in ONE transaction, UPDATEs only the photo columns — each
 *      destination's cover_image_url and each destination_images row's
 *      image_url + caption — matched by their stable ids.
 *
 * Unlike `npm run db:seed` it deletes nothing, so quiz attempts, visits and
 * favorites are kept. It refuses to run if the database does not hold every
 * dataset destination and photo row (run db:seed for that).
 */

const { loadDataset } = require('./lib/dataset');
const { connect } = require('./lib/db');
const { ensureImages, writeImageCredits } = require('./lib/images');
const { buildRows, storageClient, uploadPhotos } = require('./seed-full-dataset');

async function main() {
  const dataset = loadDataset();
  const photos = await ensureImages(dataset, { log: console.log });
  writeImageCredits(dataset);

  const { bucket, baseUrl } = storageClient();
  await uploadPhotos(bucket, photos);
  console.log(`  uploaded ${photos.length} photos`);

  const rows = buildRows(dataset, photos, baseUrl);
  const db = await connect();
  try {
    const counts = async () =>
      (
        await db.query(
          `select (select count(*)::int from public.quiz_attempts) as attempts,
                  (select count(*)::int from public.destination_completions) as visits,
                  (select count(*)::int from public.favorites) as favorites`,
        )
      ).rows[0];
    const before = await counts();

    await db.query('begin');
    let covers = 0;
    for (const row of rows.destinations) {
      const [id] = row;
      const coverUrl = row[11]; // cover_image_url (has_panorama follows it since Run 8)
      const result = await db.query(
        'update public.destinations set cover_image_url = $2::text where id = $1::uuid and cover_image_url is distinct from $2::text',
        [id, coverUrl],
      );
      const exists = await db.query('select 1 from public.destinations where id = $1', [id]);
      if (exists.rowCount !== 1) throw new Error(`destination ${id} is missing — run npm run db:seed`);
      covers += result.rowCount;
    }
    let photoRows = 0;
    for (const [id, destinationId, imageUrl, caption, sortOrder] of rows.images) {
      const exists = await db.query(
        'select 1 from public.destination_images where id = $1 and destination_id = $2',
        [id, destinationId],
      );
      if (exists.rowCount !== 1) throw new Error(`photo row ${id} is missing — run npm run db:seed`);
      const result = await db.query(
        `update public.destination_images
            set image_url = $2::text, caption = $3::text, sort_order = $4::int
          where id = $1::uuid
            and (image_url, caption, sort_order) is distinct from ($2::text, $3::text, $4::int)`,
        [id, imageUrl, caption, sortOrder],
      );
      photoRows += result.rowCount;
    }
    await db.query('commit');

    const after = await counts();
    console.log(`  changed ${covers} cover URL(s) and ${photoRows} photo row(s); everything else was already in sync`);
    console.log('  progress rows before:', before, ' after:', after);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('progress rows changed!');
    console.log('Photos in sync. No destination, quiz or progress row was removed.');
  } catch (error) {
    await db.query('rollback').catch(() => {});
    throw error;
  } finally {
    await db.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\nPhoto sync failed: ${error.message}`);
  process.exit(1);
});
