/** Small display helpers shared by cards and screens. */
import type { Destination } from '@/types/database';

/** "Calamba • Laguna", or just "Laguna" when there is no municipality. */
export function formatPlace(destination: Pick<Destination, 'municipality' | 'province'>): string {
  return destination.municipality
    ? `${destination.municipality} • ${destination.province}`
    : destination.province;
}

/** "14.2136° N, 121.1669° E", or `null` when either coordinate is missing. */
export function formatCoordinates(
  destination: Pick<Destination, 'latitude' | 'longitude'>,
): string | null {
  const { latitude, longitude } = destination;
  if (latitude === null || longitude === null) return null;
  const lat = `${Math.abs(latitude).toFixed(4)}° ${latitude >= 0 ? 'N' : 'S'}`;
  const lng = `${Math.abs(longitude).toFixed(4)}° ${longitude >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lng}`;
}

/** "1 destination" / "6 destinations". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Splits a text into its opening sentence (set as a museum-label lead) and
 * the rest. Abbreviations such as "St." or "Gen." do not end a sentence.
 * Returns `lead: null` when no sensible first sentence is found.
 */
export function splitLead(text: string, maxLeadLength = 240): { lead: string | null; rest: string } {
  const trimmed = text.trim();
  const sentenceEnd = /([.!?])\s+(?=[A-Z0-9“"‘'(])/g;
  let match: RegExpExecArray | null;
  while ((match = sentenceEnd.exec(trimmed)) !== null) {
    const end = match.index + 1;
    const lastWord = trimmed.slice(0, match.index).split(/\s+/).pop() ?? '';
    // "St", "Gen", "Fr", "Sto", "No" … and initials like "J" are abbreviations.
    if (lastWord.length <= 3 && /^[A-Z]/.test(lastWord) && match[1] === '.') continue;
    if (end > maxLeadLength) break;
    return { lead: trimmed.slice(0, end), rest: trimmed.slice(end).trim() };
  }
  return { lead: null, rest: trimmed };
}

/** "17 November 2026" (or the Filipino form), or the raw value if it cannot be read as a date. */
export function formatDate(value: string | null | undefined, locale = 'en-PH'): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
