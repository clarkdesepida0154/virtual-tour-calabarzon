/**
 * Live check of email + password auth against the real Supabase project.
 *
 *   npm run auth:test
 *
 * It uses the app's own auth and progress repositories with the publishable
 * key, exactly like the app, and:
 *   1. reads the project's auth settings (is "Confirm email" on?);
 *   2. tries a real sign-up with a throwaway @example.com address (a reserved
 *      domain that can never receive mail, so no email is ever delivered) and
 *      reports what Supabase answers — session, "confirm your email", or a
 *      refusal of the address;
 *   3. when sign-up gives no usable account, creates a confirmed throwaway
 *      user directly in auth.users (setup-script privilege, SUPABASE_DB_URL)
 *      so sign-in can still be tested — the app itself never does this;
 *   4. signs in, then reads destinations and writes / reads progress rows as
 *      the signed-in (`authenticated`) role, keyed by the auth user id;
 *   5. checks a wrong password gives the friendly message, signs out;
 *   6. deletes the progress rows and the test user (also on failure).
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { createAuthRepository } from '../src/repositories/auth.ts';
import { createDestinationsRepository } from '../src/repositories/destinations.ts';
import { createProgressRepository } from '../src/repositories/progress.ts';

const require = createRequire(import.meta.url);
const { connect } = require('./lib/db.js');

const fromRoot = (relative) => fileURLToPath(new URL(`../${relative}`, import.meta.url));
const env = Object.fromEntries(
  readFileSync(fromRoot('.env'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]]),
);
const url = env.EXPO_PUBLIC_SUPABASE_URL;
const key = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const auth = createAuthRepository(client);
const destinations = createDestinationsRepository(client);
const progress = createProgressRepository(client);

const EMAIL = `vtour-auth-check-${Date.now()}@example.com`;
const PASSWORD = `Check-${Math.random().toString(36).slice(2, 10)}-2026`;

let passed = 0;
const failures = [];
const notes = [];

async function check(name, run) {
  try {
    await run();
    passed += 1;
    console.log(`  ok    ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL  ${name}\n        ${error.message}`);
  }
}

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const db = await connect({ log: () => {} });
  let userId = null;

  try {
    console.log('\nAuth settings');
    const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } }).then((r) => r.json());
    const autoconfirm = Boolean(settings.mailer_autoconfirm);
    console.log(`  info  email sign-up enabled: ${settings.external?.email} · "Confirm email" is ${autoconfirm ? 'OFF' : 'ON'}`);

    console.log('\nSign up');
    let signUp = null;
    let signUpError = null;
    try {
      signUp = await auth.signUp(EMAIL, PASSWORD);
    } catch (error) {
      signUpError = error;
    }
    const created = await db.query('select id from auth.users where email = $1', [EMAIL]);
    userId = created.rows[0]?.id ?? null;

    if (signUpError) {
      const cause = signUpError.cause ?? {};
      console.log(`  info  sign-up answered: ${cause.code ?? '?'} — "${cause.message ?? signUpError.message}"`);
      console.log(`  info  the app would show: "${signUpError.message}"`);
      notes.push(
        `Live sign-up with a reserved test address was refused by Supabase (${cause.code ?? 'error'}), ` +
          'so no email was sent. Sign-in was tested with a database-created confirmed user instead.',
      );
    }

    if (signUp?.status === 'signed-in') {
      notes.push('Sign-up returned a session immediately: email confirmation is OFF.');
      console.log('  info  sign-up returned a session (confirmation is off)');
    } else if (signUp?.status === 'confirm-email') {
      notes.push(
        'Sign-up returned NO session: "Confirm email" is still ON in the Supabase dashboard ' +
          '(Authentication → Sign In / Providers → Email). New users must click the emailed link before signing in.',
      );
      console.log('  info  sign-up returned no session: "Confirm email" is ON — the app shows "Check your inbox"');
      await check('(test only) confirm the throwaway user in the database', async () => {
        await db.query('update auth.users set email_confirmed_at = now() where id = $1', [userId]);
      });
    }

    if (!userId) {
      await check('(test only) create a confirmed throwaway user in auth.users', async () => {
        const { rows } = await db.query(
          `insert into auth.users (
             instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
             raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
             confirmation_token, recovery_token, email_change_token_new, email_change
           ) values (
             '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
             $1, extensions.crypt($2, extensions.gen_salt('bf')), now(),
             '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
           ) returning id`,
          [EMAIL, PASSWORD],
        );
        userId = rows[0].id;
        await db.query(
          `insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
           values (gen_random_uuid(), $1::uuid, $1::text, jsonb_build_object('sub', $1::text, 'email', $2::text), 'email', now(), now())`,
          [userId, EMAIL],
        );
      });
    }

    console.log('\nSign in and use the app as the signed-in user');
    await check('signIn() with the right password returns a session for that user', async () => {
      const session = await auth.signIn(EMAIL, PASSWORD);
      expect(session?.user?.id === userId, 'session belongs to another user');
      expect((await auth.getSession())?.user?.id === userId, 'getSession() does not return it');
    });

    await check('signed-in user can read the catalogue (26 destinations)', async () => {
      const all = await destinations.list();
      expect(all.length === 26, `got ${all.length} destinations — RLS may not cover the authenticated role`);
    });

    await check('signed-in user can save a quiz attempt and a visit under their user id', async () => {
      const [first] = await destinations.list();
      expect(first, 'no destination to use');
      const attempt = await progress.recordAttempt({ userKey: userId, destinationId: first.id, score: 4, total: 5 });
      expect(attempt.device_id === userId, 'attempt not keyed by the auth user id');
      const visit = await progress.markVisited(userId, first.id);
      const again = await progress.markVisited(userId, first.id);
      expect(visit.id === again.id, 'visit not idempotent');
      expect((await progress.listAttempts(userId)).length === 1, 'attempt not readable');
      expect((await progress.listCompletions(userId)).length === 1, 'visit not readable');
    });

    await check('signOut() clears the session', async () => {
      await auth.signOut();
      expect((await auth.getSession()) === null, 'still signed in');
    });

    await check('a wrong password gives the friendly message', async () => {
      let message = '';
      try {
        await auth.signIn(EMAIL, `${PASSWORD}-wrong`);
      } catch (error) {
        message = error.message;
      }
      expect(/don’t match an account/.test(message), `unexpected message: "${message}"`);
    });

    if (signUp) await check('signing up again with the same email is refused politely', async () => {
      let message = '';
      try {
        await auth.signUp(EMAIL, PASSWORD);
      } catch (error) {
        message = error.message;
      }
      expect(/already exists/.test(message), `unexpected message: "${message}"`);
    });
  } finally {
    console.log('\nClean-up');
    if (userId) {
      await db.query('delete from auth.identities where user_id = $1', [userId]);
      await db.query('delete from public.quiz_attempts where device_id = $1', [userId]);
      await db.query('delete from public.destination_completions where device_id = $1', [userId]);
      await db.query('delete from auth.users where id = $1', [userId]);
    }
    const { rows } = await db.query('select count(*)::int as n from auth.users where email = $1', [EMAIL]);
    console.log(`  ${rows[0].n === 0 ? 'ok  ' : 'FAIL'}  test user and its progress rows deleted`);
    if (rows[0].n !== 0) failures.push('clean-up');
    await db.end();
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  for (const note of notes) console.log(`NOTE: ${note}`);
  if (failures.length > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
