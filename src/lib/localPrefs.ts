/**
 * Small values the app keeps on the device (AsyncStorage).
 *
 * The Supabase session is stored separately by supabase-js itself.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const DEVICE_ID_KEY = 'vtour.deviceId';
const GUEST_CHOSEN_KEY = 'vtour.guestChosen';

/**
 * The guest's progress key: a random UUID created once per install and kept
 * from then on. Falls back to a fresh in-memory id if storage is unavailable.
 */
export async function getOrCreateDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = randomUUID();
    await AsyncStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return randomUUID();
  }
}

/** Whether the person chose "Continue as guest" (so Welcome is skipped). */
export async function readGuestChosen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(GUEST_CHOSEN_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function writeGuestChosen(chosen: boolean): Promise<void> {
  try {
    if (chosen) await AsyncStorage.setItem(GUEST_CHOSEN_KEY, 'true');
    else await AsyncStorage.removeItem(GUEST_CHOSEN_KEY);
  } catch {
    // Not fatal: at worst the Welcome screen shows again next launch.
  }
}

// ---------------------------------------------------------------------------
// Run 4: one-time flags
// ---------------------------------------------------------------------------

const ONBOARDING_SEEN_KEY = 'vtour.onboardingSeen';
const LOCATION_PROMPT_DISMISSED_KEY = 'vtour.locationPromptDismissed';

async function readFlag(key: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(key)) === 'true';
  } catch {
    return false;
  }
}

async function writeFlag(key: string, on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.setItem(key, 'true');
    else await AsyncStorage.removeItem(key);
  } catch {
    // Not fatal: at worst the one-time screen or prompt shows again.
  }
}

/** Whether the first-launch carousel has been seen (or skipped). */
export const readOnboardingSeen = () => readFlag(ONBOARDING_SEEN_KEY);
export const writeOnboardingSeen = (seen: boolean) => writeFlag(ONBOARDING_SEEN_KEY, seen);

/** Whether the person tapped "Not now" on the Near me invitation. */
export const readLocationPromptDismissed = () => readFlag(LOCATION_PROMPT_DISMISSED_KEY);
export const writeLocationPromptDismissed = (dismissed: boolean) =>
  writeFlag(LOCATION_PROMPT_DISMISSED_KEY, dismissed);

// ---------------------------------------------------------------------------
// Run 5: settings (theme, language, narration) — one JSON value
// ---------------------------------------------------------------------------

const PREFERENCES_KEY = 'vtour.preferences';

/** The raw stored settings, or null (parse with `parsePreferences`). */
export async function readPreferencesRaw(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(PREFERENCES_KEY);
  } catch {
    return null;
  }
}

export async function writePreferencesRaw(value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFERENCES_KEY, value);
  } catch {
    // Not fatal: the choice still applies until the app is closed.
  }
}

// ---------------------------------------------------------------------------
// Run 6: badges already celebrated (per user key) and the certificate name
// ---------------------------------------------------------------------------

const seenBadgesKey = (userKey: string) => `vtour.badgesSeen.${userKey}`;
const CERTIFICATE_NAME_KEY = 'vtour.certificateName';

/** The raw "seen badges" list for a user key (parse with `parseSeenBadges`). */
export async function readSeenBadgesRaw(userKey: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(seenBadgesKey(userKey));
  } catch {
    return null;
  }
}

export async function writeSeenBadges(userKey: string, ids: readonly string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(seenBadgesKey(userKey), JSON.stringify([...ids]));
  } catch {
    // Not fatal: at worst a celebration shows once more.
  }
}

/** The name the person typed for their certificates ('' when none). */
export async function readCertificateName(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(CERTIFICATE_NAME_KEY)) ?? '';
  } catch {
    return '';
  }
}

export async function writeCertificateName(name: string): Promise<void> {
  try {
    if (name.trim()) await AsyncStorage.setItem(CERTIFICATE_NAME_KEY, name);
    else await AsyncStorage.removeItem(CERTIFICATE_NAME_KEY);
  } catch {
    // Not fatal: the name still shows until the screen closes.
  }
}
