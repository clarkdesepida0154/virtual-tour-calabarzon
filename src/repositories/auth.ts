/**
 * Auth repository — email + password accounts through Supabase Auth.
 *
 * Screens never call supabase-js; IdentityContext uses this. A factory, so
 * scripts can run the same code in Node. No React Native imports.
 */
import type { Session, SupabaseClient } from '@supabase/supabase-js';

import { AppError } from '@/lib/errors';
import { friendlyAuthMessage } from '@/lib/authForm';
import type { Database } from '@/types/database';

export type SignUpResult =
  /** Signed in straight away (email confirmation is off). */
  | { status: 'signed-in'; session: Session }
  /** Account created, but the email must be confirmed before signing in. */
  | { status: 'confirm-email'; email: string };

function authError(error: unknown, fallback: string): AppError {
  return new AppError('auth', friendlyAuthMessage(error, fallback), { cause: error });
}

export function createAuthRepository(client: SupabaseClient<Database>) {
  async function getSession(): Promise<Session | null> {
    const { data, error } = await client.auth.getSession();
    if (error) return null;
    return data.session;
  }

  /** Calls back with the new session (or null) whenever sign-in state changes. */
  function onSessionChange(callback: (session: Session | null) => void): () => void {
    const { data } = client.auth.onAuthStateChange((_event, session) => callback(session));
    return () => data.subscription.unsubscribe();
  }

  async function signIn(email: string, password: string): Promise<Session> {
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      return data.session;
    } catch (cause) {
      throw authError(cause, 'We couldn’t sign you in. Please try again.');
    }
  }

  async function signUp(email: string, password: string): Promise<SignUpResult> {
    const trimmed = email.trim();
    try {
      const { data, error } = await client.auth.signUp({ email: trimmed, password });
      if (error) throw error;
      // With "Confirm email" on, Supabase returns a user but no session. It
      // also hides whether the address was already registered (no identities).
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        throw new AppError('auth', 'An account with this email already exists. Try signing in instead.');
      }
      if (data.session) return { status: 'signed-in', session: data.session };
      return { status: 'confirm-email', email: trimmed };
    } catch (cause) {
      if (cause instanceof AppError) throw cause;
      throw authError(cause, 'We couldn’t create your account. Please try again.');
    }
  }

  async function signOut(): Promise<void> {
    // 'local' clears this device's session even when the server can't be
    // reached, so signing out always works offline.
    const { error } = await client.auth.signOut({ scope: 'local' });
    if (error) throw authError(error, 'We couldn’t sign you out. Please try again.');
  }

  return { getSession, onSessionChange, signIn, signUp, signOut };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
