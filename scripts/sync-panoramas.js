#!/usr/bin/env node
/**
 * Panorama flags top-up WITHOUT a reset (Run 8).
 *
 *   npm run db:sync-panoramas
 *
 * Copies `has_panorama` from data/destinations-seed.json (written by
 * scripts/curate-panoramas.mjs) to the live destinations, matched by their
 * stable ids, in ONE transaction. Updates that single column only; deletes
 * nothing; refuses to run when a dataset destination is missing (run
 * db:seed for that) or when the column does not exist yet (run db:migrate).
 * Destinations added in the app are never touched (they stay null →
 * optimistic). Fails if any guarded row count changes.
 */

const { loadDataset, stableId } = require('./lib/dataset');
const { connect } = require('./lib/db');

const COUNTS = `select (select count(*)::int from public.destinations) as destinations,
       (select count(*)::int from public.destination_images) as photos,
       (select count(*)::int from public.quiz_questions) as questions,
       (select count(*)::int from public.quiz_options) as options,
       (select count(*)::int from public.quiz_attempts) as attempts,
       (select count(*)::int from public.destination_completions) as visits,
       (select count(*)::int from public.favorites) as favorites,
       (select count(*)::int from public.ratings) as ratings`;

async function main() {
  const dataset = loadDataset();
  const missingFlag = dataset.destinations.filter((d) => typeof d.has_panorama !== 'boolean').map((d) => d.slug);
  if (missingFlag.length > 0) throw new Error(`has_panorama missing for ${missingFlag.join(', ')} — run scripts/curate-panoramas.mjs`);

  const db = await connect();
  try {
    const column = await db.query(
      "select 1 from information_schema.columns where table_schema = 'public' and table_name = 'destinations' and column_name = 'has_panorama'",
    );
    if (column.rowCount !== 1) throw new Error('destinations.has_panorama does not exist — run npm run db:migrate first');

    const before = (await db.query(COUNTS)).rows[0];
    console.log('Rows before:', before);
    await db.query('begin');
    let changed = 0;
    for (const destination of dataset.destinations) {
      const id = stableId(destination.slug);
      const exists = await db.query('select 1 from public.destinations where id = $1', [id]);
      if (exists.rowCount !== 1) throw new Error(`destination ${destination.slug} (${id}) is missing — run npm run db:seed`);
      const result = await db.query(
        'update public.destinations set has_panorama = $2::boolean where id = $1::uuid and has_panorama is distinct from $2::boolean',
        [id, destination.has_panorama],
      );
      changed += result.rowCount;
    }
    await db.query('commit');
    const after = (await db.query(COUNTS)).rows[0];
    console.log('Rows after: ', after);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('row counts changed!');
    const summary = (
      await db.query(
        `select count(*) filter (where has_panorama) ::int as yes,
                count(*) filter (where has_panorama = false)::int as no,
                count(*) filter (where has_panorama is null)::int as uncurated
           from public.destinations`,
      )
    ).rows[0];
    console.log(`Updated ${changed} row(s). Live flags: ${summary.yes} with a panorama, ${summary.no} without, ${summary.uncurated} not curated.`);
  } catch (error) {
    await db.query('rollback').catch(() => {});
    throw error;
  } finally {
    await db.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\nPanorama sync failed: ${error.message}`);
  process.exit(1);
});
