import type { Session } from '@supabase/supabase-js';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useDataSync } from '@/context/DataSyncContext';
import { getOrCreateDeviceId, readGuestChosen, writeGuestChosen } from '@/lib/localPrefs';
import { authRepository, progressRepository } from '@/repositories';
import type { SignUpResult } from '@/repositories';

/**
 * Who is using the app, and the key their progress is stored under.
 *
 * The progress tables have a text `device_id` column, used here as a generic
 * "user key":
 *   - signed in → the Supabase auth user id;
 *   - guest     → a device UUID generated once and kept in AsyncStorage.
 *
 * Auth never blocks a feature: guests can do everything, their progress is
 * simply keyed to the device instead of an account.
 */
export type Identity = {
  /** False until the saved session and device id have been read. */
  isReady: boolean;
  kind: 'user' | 'guest';
  /** Key for every progress row. Empty only while `isReady` is false. */
  userKey: string;
  email: string | null;
  /** "you@example.com" or "Guest". */
  label: string;
  /** No session and no "continue as guest" choice yet → show Welcome. */
  needsWelcome: boolean;
  continueAsGuest: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
};

const IdentityContext = createContext<Identity | null>(null);

type Loaded = { deviceId: string; guestChosen: boolean };

const SESSION_RESTORE_TIMEOUT = 4000;

export function IdentityProvider({ children }: { children: ReactNode }) {
  const { notifyChanged } = useDataSync();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    // Never hold the splash screen hostage: if restoring the session stalls
    // (offline with an expired token), start as signed-out and let the
    // auth listener catch up.
    const savedSession = Promise.race([
      authRepository.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), SESSION_RESTORE_TIMEOUT)),
    ]);
    Promise.all([savedSession, getOrCreateDeviceId(), readGuestChosen()]).then(
      ([saved, deviceId, guestChosen]) => {
        if (!active) return;
        setSession(saved);
        setLoaded({ deviceId, guestChosen });
      },
    );
    const unsubscribe = authRepository.onSessionChange((next) => {
      if (active) setSession(next);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const setGuestChosen = useCallback(async (chosen: boolean) => {
    await writeGuestChosen(chosen);
    setLoaded((current) => (current ? { ...current, guestChosen: chosen } : current));
  }, []);

  const continueAsGuest = useCallback(() => setGuestChosen(true), [setGuestChosen]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const next = await authRepository.signIn(email, password);
      setSession(next);
      await setGuestChosen(false);
      notifyChanged();
    },
    [notifyChanged, setGuestChosen],
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<SignUpResult> => {
      const result = await authRepository.signUp(email, password);
      if (result.status === 'signed-in') {
        // A guest who creates an account keeps everything they did as a guest.
        if (loaded?.guestChosen && loaded.deviceId) {
          try {
            await progressRepository.transferProgress(loaded.deviceId, result.session.user.id);
          } catch {
            // Their account still works; the guest progress simply stays on the device key.
          }
        }
        setSession(result.session);
        await setGuestChosen(false);
        notifyChanged();
      }
      return result;
    },
    [loaded, notifyChanged, setGuestChosen],
  );

  const signOut = useCallback(async () => {
    await authRepository.signOut();
    setSession(null);
    await setGuestChosen(false);
    notifyChanged();
  }, [notifyChanged, setGuestChosen]);

  const value = useMemo<Identity>(() => {
    const user = session?.user ?? null;
    return {
      isReady: loaded !== null,
      kind: user ? 'user' : 'guest',
      userKey: user?.id ?? loaded?.deviceId ?? '',
      email: user?.email ?? null,
      label: user?.email ?? 'Guest',
      needsWelcome: loaded !== null && !user && !loaded.guestChosen,
      continueAsGuest,
      signIn,
      signUp,
      signOut,
    };
  }, [session, loaded, continueAsGuest, signIn, signUp, signOut]);

  return <IdentityContext value={value}>{children}</IdentityContext>;
}

export function useIdentity(): Identity {
  const value = use(IdentityContext);
  if (!value) throw new Error('useIdentity must be used inside <IdentityProvider>.');
  return value;
}
