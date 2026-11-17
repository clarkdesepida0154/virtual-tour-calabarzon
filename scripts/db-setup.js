#!/usr/bin/env node
/**
 * Database setup for the Virtual Tour and Cultural Mapping App.
 *
 *   npm run db:setup     Runs supabase/schema.sql (RESET + tables + RLS +
 *                        storage + seed), then verifies the result.
 *   npm run db:verify    Verifies the current database without changing it.
 *
 * WARNING: db:setup is destructive by design — schema.sql starts with a RESET
 * section, so every destination (including ones added from the app) is
 * replaced by the seed data.
 *
 * Connection: reads SUPABASE_DB_URL from .env. The direct Supabase host is
 * IPv6-only, so if it is unreachable the script falls back to the IPv4
 * poolers and writes the first URL that works back to .env.
 *
 * This file is tooling only. App code must never read SUPABASE_DB_URL.
 */

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const SCHEMA_PATH = path.join(ROOT, 'supabase', 'schema.sql');

const POOLER_REGION = 'ap-southeast-1';
const BUCKET_ID = 'destination-images';
const EXPECTED_TABLES = [
  'destination_completions',
  'destination_images',
  'destinations',
  'quiz_attempts',
  'quiz_options',
  'quiz_questions',
];
/** Sections that may be skipped when the database role lacks storage rights. */
const STORAGE_SECTIONS = new Set(['reset-storage', 'storage']);

const verifyOnly = process.argv.includes('--verify-only');

// ---------------------------------------------------------------------------
// .env helpers
// ---------------------------------------------------------------------------

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    throw new Error('.env not found. Copy .env.example to .env and fill it in.');
  }
  const values = {};
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return values;
}

function saveDbUrl(url) {
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/);
  const index = lines.findIndex((line) => /^\s*SUPABASE_DB_URL\s*=/.test(line));
  if (index >= 0) lines[index] = `SUPABASE_DB_URL=${url}`;
  else lines.push(`SUPABASE_DB_URL=${url}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n'));
}

function mask(url) {
  return url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@');
}

// ---------------------------------------------------------------------------
// Connection candidates
// ---------------------------------------------------------------------------

/**
 * Builds the ordered list of connection strings to try. Nothing secret is
 * hardcoded here: the password and project ref come from .env.
 */
function buildCandidates(env) {
  const current = env.SUPABASE_DB_URL;
  if (!current) throw new Error('SUPABASE_DB_URL is missing from .env.');

  const parsed = new URL(current);
  const password = encodeURIComponent(decodeURIComponent(parsed.password));
  const projectRef =
    (parsed.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/) || [])[1] ||
    (decodeURIComponent(parsed.username).match(/^postgres\.([a-z0-9]+)$/) || [])[1] ||
    ((env.EXPO_PUBLIC_SUPABASE_URL || '').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/) || [])[1];

  if (!projectRef) return [current];

  const pooler = (index, port) =>
    `postgresql://postgres.${projectRef}:${password}@aws-${index}-${POOLER_REGION}.pooler.supabase.com:${port}/postgres`;

  const ordered = [
    current, // whatever worked last time goes first
    `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
    pooler(1, 5432),
    pooler(0, 5432),
    pooler(1, 6543),
  ];
  return [...new Set(ordered)];
}

async function connect(candidates) {
  for (const url of candidates) {
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    // A dropped connection should surface as a query error, not crash Node.
    client.on('error', () => {});
    try {
      process.stdout.write(`  trying ${mask(url)} ... `);
      await client.connect();
      await client.query('select 1');
      console.log('connected');
      return { client, url };
    } catch (error) {
      console.log(`failed (${error.code || error.message})`);
      await client.end().catch(() => {});
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// schema.sql
// ---------------------------------------------------------------------------

function readSections() {
  const sql = fs.readFileSync(SCHEMA_PATH, 'utf8');
  const parts = sql.split(/^-- @section\s+([a-z0-9-]+)\s*$/m);
  // parts = [preamble, name1, body1, name2, body2, ...]
  const sections = [];
  for (let i = 1; i < parts.length; i += 2) {
    sections.push({ name: parts[i], sql: parts[i + 1] });
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

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

async function verify(client) {
  const problems = [];

  const tables = await client.query(
    `select c.relname as name, c.relrowsecurity as rls,
            (select count(*)::int from pg_policies p
              where p.schemaname = 'public' and p.tablename = c.relname) as policies
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname`,
  );
  console.log('\n  Tables in public schema:');
  for (const row of tables.rows) {
    console.log(
      `    - ${row.name.padEnd(26)} RLS ${row.rls ? 'on ' : 'OFF'}  policies: ${row.policies}`,
    );
  }
  const found = new Map(tables.rows.map((row) => [row.name, row]));
  for (const name of EXPECTED_TABLES) {
    const row = found.get(name);
    if (!row) problems.push(`missing table "${name}"`);
    else if (!row.rls) problems.push(`RLS is off on "${name}"`);
    else if (row.policies < 4) problems.push(`"${name}" has only ${row.policies} policies`);
  }

  if (found.has('destinations')) {
    const seeds = await client.query(
      'select name, municipality, province, category from public.destinations order by name',
    );
    console.log(`\n  Destinations: ${seeds.rowCount} row(s)`);
    for (const row of seeds.rows) {
      console.log(
        `    - ${row.name} (${row.municipality || '—'}, ${row.province}) · ${row.category}`,
      );
    }
    if (seeds.rowCount === 0) problems.push('destinations table is empty');
  }

  let storageReady = false;
  try {
    const bucket = await client.query(
      'select id, public from storage.buckets where id = $1',
      [BUCKET_ID],
    );
    const policies = await client.query(
      `select count(*)::int as count from pg_policies
        where schemaname = 'storage' and tablename = 'objects'
          and policyname like 'destination_images_anon_%'`,
    );
    const row = bucket.rows[0];
    console.log(
      `\n  Storage bucket "${BUCKET_ID}": ${
        row ? (row.public ? 'public' : 'PRIVATE') : 'MISSING'
      } · policies: ${policies.rows[0].count}`,
    );
    storageReady = Boolean(row && row.public && policies.rows[0].count >= 4);
  } catch (error) {
    console.log(`\n  Storage check failed: ${error.message}`);
  }

  return { problems, storageReady };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const env = readEnvFile();
  const candidates = buildCandidates(env);

  console.log('Connecting to Supabase Postgres');
  const connection = await connect(candidates);
  if (!connection) {
    console.error(
      '\nCould not reach the database with any known connection string.\n' +
        'Open the Supabase dashboard, click the green "Connect" button, copy the\n' +
        '"Session pooler" connection string, and paste it into .env as SUPABASE_DB_URL.',
    );
    process.exit(2);
  }

  const { client, url } = connection;
  try {
    if (url !== env.SUPABASE_DB_URL) {
      saveDbUrl(url);
      console.log('  saved the working connection string to .env as SUPABASE_DB_URL');
    }

    let skipped = [];
    if (verifyOnly) {
      console.log('\nVerify only — schema.sql was not run.');
    } else {
      console.log('\nRunning supabase/schema.sql');
      skipped = await runSchema(client);
    }

    console.log('\nVerifying');
    const { problems, storageReady } = await verify(client);

    console.log('');
    if (!storageReady) {
      console.log(
        `ACTION NEEDED: storage is not fully set up${
          skipped.length ? ` (skipped: ${skipped.join(', ')})` : ''
        }.\n` +
          `  In Supabase → Storage, create a PUBLIC bucket named "${BUCKET_ID}".\n` +
          '  Image uploads will fail until it exists; everything else works.',
      );
    }
    if (problems.length > 0) {
      console.error(`Setup has problems:\n  - ${problems.join('\n  - ')}`);
      process.exitCode = 1;
    } else {
      console.log(`Database is ready${storageReady ? ' (tables, RLS, storage, seed data).' : '.'}`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(`\n${error.message}`);
  process.exit(1);
});
