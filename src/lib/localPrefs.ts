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
