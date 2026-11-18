import * as Location from 'expo-location';
import { createContext, use, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { readLocationPromptDismissed, writeLocationPromptDismissed } from '@/lib/localPrefs';
import type { Coordinate } from '@/lib/mapRegion';

/**
 * "Near me": the learner's approximate position, used only on the phone to
 * show "12.4 km away" and to sort Explore nearest first. It is never sent
 * anywhere.
 *
 * Permission is asked politely: never on launch, only after the person taps
 * "Allow" on the in-app invitation (or picks "Nearest first"). If they
 * decline — here or in the system dialog — the feature simply hides.
 */
export type LocationStatus =
  /** Still reading the permission state. */
  | 'checking'
  /** Not asked yet: the invitation may be shown. */
  | 'undetermined'
  /** Allowed; `position` follows as soon as the phone has a fix. */
  | 'granted'
  /** Declined, or location is switched off: every distance hides. */
  | 'denied';

type LocationValue = {
  status: LocationStatus;
  position: Coordinate | null;
  /** True when distances can be shown right now. */
  isAvailable: boolean;
  /** Whether the Near me feature should appear at all (hidden once declined). */
  isOffered: boolean;
  /** The person tapped "Not now" on the invitation. */
  promptDismissed: boolean;
  /** Shows the system dialog. Resolves `true` when location was allowed. */
  requestPermission: () => Promise<boolean>;
  dismissPrompt: () => void;
};

const LocationContext = createContext<LocationValue | null>(null);

/** Coarse is plenty for "km away", and much faster to obtain. */
const ACCURACY = Location.Accuracy.Balanced;
/** A last known fix younger than this is good enough to start with. */
const LAST_KNOWN_MAX_AGE = 15 * 60 * 1000;

function toCoordinate(fix: Location.LocationObject | null): Coordinate | null {
  if (!fix) return null;
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<LocationStatus>('checking');
  const [position, setPosition] = useState<Coordinate | null>(null);
  const [promptDismissed, setPromptDismissed] = useState(false);

  /** Gets a fix: the last known one first (instant), then a fresh one. */
  const locate = useCallback(async () => {
    let found = false;
    try {
      const quick = toCoordinate(
        await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE }),
      );
      if (quick) {
        found = true;
        setPosition(quick);
      }
    } catch {
      // Fine — the fresh fix below may still work.
    }
    try {
      const fresh = toCoordinate(await Location.getCurrentPositionAsync({ accuracy: ACCURACY }));
      if (fresh) {
        found = true;
        setPosition(fresh);
      }
    } catch {
      // Location services off or no fix — handled below.
    }
    // Allowed but no fix at all (e.g. location switched off): hide the
    // feature rather than nag.
    if (!found) setStatus('denied');
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      Location.getForegroundPermissionsAsync().catch(() => null),
      readLocationPromptDismissed(),
    ]).then(([permission, dismissed]) => {
      if (!active) return;
      setPromptDismissed(dismissed);
      if (permission?.granted) {
        setStatus('granted');
        void locate();
      } else if (permission && permission.status === Location.PermissionStatus.UNDETERMINED) {
        setStatus('undetermined');
      } else {
        setStatus('denied');
      }
    });
    return () => {
      active = false;
    };
  }, [locate]);

  const requestPermission = useCallback(async () => {
    try {
      const result = await Location.requestForegroundPermissionsAsync();
      if (result.granted) {
        setStatus('granted');
        void locate();
        return true;
      }
    } catch {
      // Treated like a refusal.
    }
    setStatus('denied');
    return false;
  }, [locate]);

  const dismissPrompt = useCallback(() => {
    setPromptDismissed(true);
    void writeLocationPromptDismissed(true);
  }, []);

  const value = useMemo<LocationValue>(
    () => ({
      status,
      position,
      isAvailable: status === 'granted' && position !== null,
      isOffered: status === 'granted' || status === 'undetermined',
      promptDismissed,
      requestPermission,
      dismissPrompt,
    }),
    [status, position, promptDismissed, requestPermission, dismissPrompt],
  );

  return <LocationContext value={value}>{children}</LocationContext>;
}

export function useUserLocation(): LocationValue {
  const value = use(LocationContext);
  if (!value) throw new Error('useUserLocation must be used inside <LocationProvider>.');
  return value;
}
