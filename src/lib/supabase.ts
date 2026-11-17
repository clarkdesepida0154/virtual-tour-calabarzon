/**
 * The app's single Supabase client.
 *
 * Only the repositories in src/repositories may import this — screens and
 * components never talk to supabase-js directly.
 *
 * The publishable key is safe to ship: it maps to the Postgres `anon` role,
 * and what that role may do is decided by the RLS policies in schema.sql.
 */
import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '@/lib/errors';
import type { Database } from '@/types/database';

export type AppSupabaseClient = SupabaseClient<Database>;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new AppError(
    'config',
    'Supabase is not configured. Copy .env.example to .env, fill in ' +
      'EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, then restart Expo.',
  );
}

export const supabase: AppSupabaseClient = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
  {
    // No sign-in in this app, so there is no session to store or refresh.
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
