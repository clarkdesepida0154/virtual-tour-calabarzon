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
