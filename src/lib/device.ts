/**
 * Small wrappers around phone features: haptics, the Google Maps hand-off and
 * the share sheet. Every function is safe to call anywhere — on web or when a
 * feature is missing it quietly does nothing (or reports `false`), so a screen
 * never crashes over a vibration or an absent maps app.
 */
import * as Haptics from 'expo-haptics';
import { Linking, Platform, Share } from 'react-native';

import { hasCoordinates } from '@/lib/mapRegion';
import { buildShareContent, directionsUrl, streetViewUrl } from '@/lib/outbound';
import type { Destination } from '@/types/database';

const HAPTICS_AVAILABLE = Platform.OS === 'ios' || Platform.OS === 'android';

/** A light tap — choosing a quiz answer, toggling a favorite. */
export function tapFeedback(): void {
  if (!HAPTICS_AVAILABLE) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** A success buzz — finishing a quiz, marking a place visited. */
export function successFeedback(): void {
  if (!HAPTICS_AVAILABLE) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/**
 * Opens turn-by-turn directions from the user's current location to `place`.
 *
 * The Google Maps universal link opens the Google Maps app when it is
 * installed and maps.google.com in the browser when it is not. If even that
 * fails, Android gets one more try with a `geo:` link (any maps app).
 * Resolves `false` when nothing could be opened, so the caller can say so.
 */
export async function openDirections(place: {
  latitude: number | null;
  longitude: number | null;
}): Promise<boolean> {
  const url = directionsUrl(place);
  if (!url || !hasCoordinates(place)) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    if (Platform.OS !== 'android') return false;
    const point = `${place.latitude},${place.longitude}`;
    try {
      await Linking.openURL(`geo:${point}?q=${point}`);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Opens Google Street View (360°) at `place` — the Google Maps app when it is
 * installed, the browser otherwise. Resolves `false` when nothing opened.
 */
export async function openStreetView(place: { latitude: number | null; longitude: number | null }): Promise<boolean> {
  const url = streetViewUrl(place);
  if (!url) return false;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Opens any web link (e.g. the field-trip route in Google Maps). Resolves `false` when it could not. */
export async function openExternalUrl(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

export type ShareOutcome = 'shared' | 'dismissed' | 'unavailable';

/** Opens the native share sheet with the destination's name, one-line summary and place. */
export async function shareDestination(
  destination: Pick<Destination, 'name' | 'description' | 'municipality' | 'province'>,
): Promise<ShareOutcome> {
  const content = buildShareContent(destination);
  try {
    // On web this resolves to `undefined` (the Web Share API returns nothing).
    const result: { action?: string } | undefined = await Share.share(content, {
      dialogTitle: `Share ${destination.name}`,
    });
    return result?.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch (error) {
    // A person closing the browser's share sheet is not a failure.
    if (error instanceof Error && error.name === 'AbortError') return 'dismissed';
    // e.g. a desktop browser without the Web Share API.
    return 'unavailable';
  }
}
