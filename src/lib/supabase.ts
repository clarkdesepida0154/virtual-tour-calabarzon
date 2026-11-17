/**
 * The app's single Supabase client.
 *
 * Only the repositories in src/repositories may import this — screens and
 * components never talk to supabase-js directly.
 *
 * The publishable key is safe to ship: it maps to the Postgres `anon` role
 * (or `authenticated` once someone signs in), and what those roles may do is
 * decided by the RLS policies in schema.sql.
 */
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

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
    // Email + password sign-in. The session is kept in AsyncStorage so people
    // stay signed in between launches (on web it lands in localStorage).
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  },
);

// Refresh the session token only while the app is in the foreground, as
// Supabase recommends for React Native. The browser handles this itself.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
