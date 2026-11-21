/**
 * The Photo Credits screen's data: every photo's credit line, grouped by
 * destination (A–Z), cover first. Pure — unit-tested in Node.
 */
import type { DestinationImage, DestinationSummary } from '@/types/database';

export type CreditLine = {
  id: string;
  /** 0 = the cover, then the gallery photos in order. */
  position: number;
  caption: string;
};

export type CreditGroup = {
  destination: Pick<DestinationSummary, 'id' | 'name' | 'province'>;
  credits: CreditLine[];
};

/**
 * Groups photo rows under their destinations. Rows without a caption, and
 * rows of destinations no longer in the catalogue, are left out; destinations
 * without any credited photo are omitted.
 */
export function groupCredits(
  destinations: readonly Pick<DestinationSummary, 'id' | 'name' | 'province'>[],
  images: readonly Pick<DestinationImage, 'id' | 'destination_id' | 'caption' | 'sort_order'>[],
): CreditGroup[] {
  const byDestination = new Map<string, CreditLine[]>();
  for (const image of images) {
    const caption = image.caption?.trim();
    if (!caption) continue;
    const list = byDestination.get(image.destination_id) ?? [];
    list.push({ id: image.id, position: image.sort_order, caption });
    byDestination.set(image.destination_id, list);
  }
  return [...destinations]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((destination) => ({
      destination: { id: destination.id, name: destination.name, province: destination.province },
      credits: (byDestination.get(destination.id) ?? []).sort((a, b) => a.position - b.position),
    }))
    .filter((group) => group.credits.length > 0);
}

/** How many credit lines there are in total. */
export function countCredits(groups: readonly CreditGroup[]): number {
  return groups.reduce((sum, group) => sum + group.credits.length, 0);
}
