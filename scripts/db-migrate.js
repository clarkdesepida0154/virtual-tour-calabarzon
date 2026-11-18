#!/usr/bin/env node
/**
 * Applies the additive migrations in supabase/migrations/ to the live
 * database — WITHOUT the reset that `npm run db:setup` performs. Existing
 * destinations, quiz attempts and visits are left exactly as they are.
 *
 *   npm run db:migrate
 *
 * Every migration must be idempotent (create … if not exists, drop policy if
 * exists → create policy), so running this again is harmless. Each file runs
 * in its own transaction; the first failure stops the run.
 *
 * Connection: SUPABASE_DB_URL from .env (scripts/lib/db.js). Tooling only.
 */

const fs = require('node:fs');
const path = require('node:path');

const { connect } = require('./lib/db');
const { ROOT } = require('./lib/env');

const DIR = path.join(ROOT, 'supabase', 'migrations');

async function main() {
  const files = fs
    .readdirSync(DIR)
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  const client = await connect();
  try {
    const before = await client.query(
      `select (select count(*)::int from public.destinations) as destinations,
              (select count(*)::int from public.quiz_attempts) as attempts,
              (select count(*)::int from public.destination_completions) as visits`,
    );
    console.log('Rows before:', before.rows[0]);

    for (const name of files) {
      process.stdout.write(`  ${name} … `);
      const sql = fs.readFileSync(path.join(DIR, name), 'utf8');
      try {
        await client.query('begin');
        await client.query(sql);
        await client.query('commit');
        console.log('ok');
      } catch (error) {
        await client.query('rollback').catch(() => {});
        console.log('FAILED');
        throw error;
      }
    }

    const after = await client.query(
      `select (select count(*)::int from public.destinations) as destinations,
              (select count(*)::int from public.quiz_attempts) as attempts,
              (select count(*)::int from public.destination_completions) as visits`,
    );
    console.log('Rows after: ', after.rows[0]);
    const changed = Object.keys(before.rows[0]).filter(
      (key) => before.rows[0][key] !== after.rows[0][key],
    );
    if (changed.length > 0) throw new Error(`Existing data changed: ${changed.join(', ')}`);
    console.log('Existing data untouched.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(`\nMigration failed: ${error.message}`);
  process.exit(1);
});
