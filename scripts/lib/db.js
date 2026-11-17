/**
 * Postgres connection for the setup scripts (never used by the app).
 *
 * SUPABASE_DB_URL in .env is tried first. Supabase's direct host is IPv6-only,
 * so if the saved URL stops working the IPv4 poolers are tried in turn and the
 * first one that connects is written back to .env.
 */

const { Client } = require('pg');

const { readEnvFile, saveEnvValue } = require('./env');

const POOLER_REGION = 'ap-southeast-1';

function mask(url) {
  return url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:****@');
}

/** Ordered connection strings. Nothing secret is hardcoded: it all comes from .env. */
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

  return [
    ...new Set([
      current, // whatever worked last time goes first
      `postgresql://postgres:${password}@db.${projectRef}.supabase.co:5432/postgres`,
      pooler(1, 5432),
      pooler(0, 5432),
      pooler(1, 6543),
    ]),
  ];
}

/**
 * Connects and returns a pg Client. Exits the process with a clear message
 * when no connection string works.
 */
async function connect({ log = console.log } = {}) {
  const env = readEnvFile();

  for (const url of buildCandidates(env)) {
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 12000,
    });
    // A dropped connection should surface as a query error, not crash Node.
    client.on('error', () => {});
    try {
      await client.connect();
      await client.query('select 1');
      log(`  connected to ${mask(url)}`);
      if (url !== env.SUPABASE_DB_URL) {
        saveEnvValue('SUPABASE_DB_URL', url);
        log('  saved the working connection string to .env as SUPABASE_DB_URL');
      }
      return client;
    } catch (error) {
      log(`  ${mask(url)} failed (${error.code || error.message})`);
      await client.end().catch(() => {});
    }
  }

  console.error(
    '\nCould not reach the database with any known connection string.\n' +
      'Open the Supabase dashboard, click the green "Connect" button, copy the\n' +
      '"Session pooler" connection string, and paste it into .env as SUPABASE_DB_URL.',
  );
  process.exit(2);
}

module.exports = { connect };
