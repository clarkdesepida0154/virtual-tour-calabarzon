/**
 * Builders for the things the app hands to other apps: the Google Maps
 * directions link and the text of the share sheet. Pure, no React Native
 * imports (the screens do the actual Linking / Share calls).
 */
import { formatPlace, splitLead } from '@/lib/format';
import { hasCoordinates } from '@/lib/mapRegion';
import type { Destination } from '@/types/database';

/**
 * Google Maps "universal" directions link. With no `origin`, Google Maps
 * starts from the user's current location. On a phone it opens the Google
 * Maps app when installed, and maps.google.com in the browser otherwise.
 * No API key is involved. Returns `null` without usable coordinates.
 */
export function directionsUrl(place: { latitude: number | null; longitude: number | null }): string | null {
  if (!hasCoordinates(place)) return null;
  const lat = Number(place.latitude.toFixed(6));
  const lng = Number(place.longitude.toFixed(6));
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

/** The opening sentence of a description, for one-line summaries. */
export function oneLineSummary(text: string, maxLength = 200): string {
  const { lead, rest } = splitLead(text, maxLength);
  const line = (lead ?? rest).replace(/\s+/g, ' ').trim();
  if (line.length <= maxLength) return line;
  const cut = line.slice(0, maxLength - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), 0)) || cut}…`;
}

export type ShareContent = { title: string; message: string };

/** What the native share sheet receives: name, one-line description, "Town • Province". */
export function buildShareContent(
  destination: Pick<Destination, 'name' | 'description' | 'municipality' | 'province'>,
): ShareContent {
  return {
    title: destination.name,
    message: [destination.name, oneLineSummary(destination.description), formatPlace(destination)].join('\n'),
  };
}
