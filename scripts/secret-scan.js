#!/usr/bin/env node
/**
 * Secret scan — run before every push:   npm run secrets:check
 *
 * Reads the real values from .env and looks for them in every tracked file
 * AND in every patch of the full git history: the database password (raw and
 * URL-encoded), any "sb_secret" key, connection strings with a literal
 * password, and Google API keys. Also checks that .env is git-ignored and was
 * never committed. Prints counts only — never a secret value. Exits 2 on a hit.
 */
const { execSync } = require('node:child_process');
const fs = require('node:fs');

const sh = (cmd) => execSync(cmd, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 512 });
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const dbUrl = new URL(env.SUPABASE_DB_URL);
const password = decodeURIComponent(dbUrl.password);
const results = [];
const report = (label, hits) => results.push(`${hits === 0 ? 'CLEAN' : 'HIT  '}  ${label}: ${hits}`);

// 1. .env is ignored and never committed
let ignored = false;
try { sh('git check-ignore -q .env'); ignored = true; } catch {}
results.push(`${ignored ? 'CLEAN' : 'HIT  '}  .env is git-ignored: ${ignored}`);
const envHistory = sh('git log --all --full-history --format=%H -- .env ":(glob).env.*" ":(exclude).env.example"').trim();
const envFilesEver = sh('git log --all --full-history --name-only --format= ').split(/\r?\n/)
  .filter((f) => /(^|\/)\.env($|\.)/.test(f) && !f.endsWith('.env.example'));
report('commits that ever touched .env / .env.* (excluding .env.example)', envHistory ? envHistory.split('\n').length : 0);
report('.env-like paths ever in history', new Set(envFilesEver).size);

// 2. Content: working tree (tracked files) + every patch in history
const tracked = sh('git ls-files -z').split('\0').filter(Boolean);
const treeText = tracked
  .filter((f) => !/\.(jpg|jpeg|png|ico|ttf|hbc)$/i.test(f) && fs.existsSync(f))
  .map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const historyText = sh('git log --all -p --no-color --text -- . ":(exclude)*.jpg" ":(exclude)*.png"');
const allText = { 'tracked files': treeText, 'full history (all patches)': historyText };

const encodedPw = encodeURIComponent(password);
const connWithPassword = /postgres(?:ql)?:\/\/[^\s:'"`/]+:([^\s@'"`]+)@/gi;
for (const [where, body] of Object.entries(allText)) {
  const count = (needle) => (needle ? body.split(needle).length - 1 : 0);
  report(`${where} — database password (raw)`, count(password));
  report(`${where} — database password (URL-encoded)`, encodedPw !== password ? count(encodedPw) : 0);
  report(`${where} — "sb_secret"`, count('sb_secret'));
  const conns = [...body.matchAll(connWithPassword)]
    .filter((m) => !/^(\$\{|\*{3,}|<|password|PASSWORD|\[)/.test(m[1])); // placeholders / masked
  report(`${where} — connection strings with a literal password`, conns.length);
  if (conns.length) results.push(`         (masked) ${conns.slice(0, 3).map((m) => m[0].replace(m[1], '****')).join(' ; ')}`);
  if (env.GOOGLE_MAPS_ANDROID_API_KEY) report(`${where} — Google Maps key`, count(env.GOOGLE_MAPS_ANDROID_API_KEY));
  report(`${where} — Google API key pattern (AIza…)`, (body.match(/AIza[0-9A-Za-z_-]{35}/g) || []).length);
  // informational: the publishable key is designed to be public, but should still only live in .env
  results.push(`info   ${where} — publishable key occurrences: ${count(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY)}`);
}
console.log(results.join('\n'));
const hits = results.filter((l) => l.startsWith('HIT')).length;
console.log(`\n${hits === 0 ? 'SECRET SCAN CLEAN' : `SECRET SCAN FOUND ${hits} PROBLEM(S)`}`);
process.exit(hits === 0 ? 0 : 2);
