#!/usr/bin/env node
/**
 * Database setup for the Virtual Tour and Cultural Mapping App.
 *
 *   npm run db:setup     Full reset: runs supabase/schema.sql (drop + create
 *                        tables, RLS, storage bucket), seeds the REAL dataset
 *                        from data/destinations-seed.json, then verifies.
 *   npm run db:verify    Verifies the current database without changing it.
 *   npm run db:seed      Re-seeds the dataset only (see seed-full-dataset.js).
 *
 * WARNING: db:setup is destructive by design. Destinations added from the app
 * and all quiz / progress data are removed; the database ends up holding
 * exactly the 26 destinations in the dataset.
 *
 * Connection: SUPABASE_DB_URL from .env (see scripts/lib/db.js for the
 * fallback hosts). This file is tooling only — app code never reads that URL.
 */

const fs = require('node:fs');
const path = require('node:path');

const { connect } = require('./lib/db');
const { ROOT } = require('./lib/env');
const { verifyDatabase } = require('./lib/verify');
const { seedFullDataset } = require('./seed-full-dataset');

const SCHEMA_PATH = path.join(ROOT, 'supabase', 'schema.sql');

/** Sections that may be skipped when the database role lacks storage rights. */
const STORAGE_SECTIONS = new Set(['reset-storage', 'storage']);

const verifyOnly = process.argv.includes('--verify-only');

function readSections() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const parts = sql.split(/^-- @section\s+([a-z0-9-]+)\s*$/m);
  // parts = [preamble, name1, body1, name2, body2, ...]
  const sections = [];
  for (let index = 1; index < parts.length; index += 2) {
    sections.push({ name: parts[index], sql: parts[index + 1] });
  }
  if (sections.length === 0) {
    throw new Error('No "-- @section" markers found in supabase/schema.sql.');
  }
  return sections;
}

function isPermissionError(error) {
  return (
    error.code === '42501' ||
    /permission denied|must be owner|insufficient privilege/i.test(error.message)
  );
}

async function runSchema(client) {
  const skipped = [];
  for (const section of readSections()) {
    process.stdout.write(`  ${section.name.padEnd(14)} `);
    try {
      // One multi-statement query = one implicit transaction per section.
      await client.query(section.sql);
      console.log('ok');
    } catch (error) {
      if (STORAGE_SECTIONS.has(section.name) && isPermissionError(error)) {
        console.log(`skipped (no permission: ${error.message})`);
        skipped.push(section.name);
        continue;
      }
      console.log('FAILED');
      throw new Error(`Section "${section.name}" failed: ${error.message}`);
    }
  }
  return skipped;
}

async function main() {
  console.log('Connecting to Supabase Postgres');
  const client = await connect();

  try {
    if (verifyOnly) {
      console.log('\nVerify only — nothing is changed.');
    } else {
      console.log('\nRunning supabase/schema.sql');
      const skipped = await runSchema(client);
      if (skipped.length > 0) {
        console.log(
          `\nACTION NEEDED: storage setup was skipped (${skipped.join(', ')}).\n` +
            '  In Supabase → Storage, create a PUBLIC bucket named "destination-images",\n' +
            '  then run `npm run db:seed`.',
        );
      }

      console.log('\nSeeding the full dataset (data/destinations-seed.json)');
      await seedFullDataset({ client });
    }

    console.log('\nVerifying');
    const problems = await verifyDatabase(client);

    console.log('');
    if (problems.length > 0) {
      console.error(`Problems found:\n  - ${problems.join('\n  - ')}`);
      process.exitCode = 1;
    } else {
      console.log('Database is ready: tables, RLS, storage, and the full 26-destination dataset.');
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
