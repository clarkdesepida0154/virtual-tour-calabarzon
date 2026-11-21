import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { readPreferencesRaw, writePreferencesRaw } from '@/lib/localPrefs';
import { DEFAULT_PREFERENCES, parsePreferences } from '@/lib/preferences';
import type { Preferences } from '@/lib/preferences';

type PreferencesValue = {
  /** False until the saved settings have been read (the splash stays up). */
  isReady: boolean;
  preferences: Preferences;
  /** Changes one or more settings; applied at once and saved on the device. */
  update: (changes: Partial<Preferences>) => void;
};

const PreferencesContext = createContext<PreferencesValue | null>(null);

/**
 * Theme, language and narration settings. Read before the first screen is
 * drawn, so the app never flashes the wrong theme or language.
 */
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ isReady: boolean; changed: boolean; preferences: Preferences }>({
    isReady: false,
    changed: false,
    preferences: DEFAULT_PREFERENCES,
  });

  useEffect(() => {
    let active = true;
    readPreferencesRaw().then((raw) => {
      if (active) setState({ isReady: true, changed: false, preferences: parsePreferences(raw) });
    });
    return () => {
      active = false;
    };
  }, []);

  // Save after every change made in Settings (not after the initial read).
  useEffect(() => {
    if (state.changed) void writePreferencesRaw(JSON.stringify(state.preferences));
  }, [state]);

  const update = useCallback((changes: Partial<Preferences>) => {
    setState((current) => ({ ...current, changed: true, preferences: { ...current.preferences, ...changes } }));
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({ isReady: state.isReady, preferences: state.preferences, update }),
    [state, update],
  );

  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): PreferencesValue {
  const value = use(PreferencesContext);
  if (!value) throw new Error('usePreferences must be used inside <PreferencesProvider>.');
  return value;
}
