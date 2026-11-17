/**
 * Pure helpers for the Home screen: per-category / per-province counts, and
 * the choice of "Featured" destinations.
 *
 * No React and no React Native here, so scripts/verify-crud.mjs can run them
 * under Node against the live data.
 */
import { CATEGORIES, PROVINCES } from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';

export type DestinationCounts = {
  total: number;
  byCategory: Record<Category, number>;
  byProvince: Record<Province, number>;
};

type Classified = { category: Category; province: Province };

export function countDestinations(items: readonly Classified[]): DestinationCounts {
  const counts: DestinationCounts = {
    total: items.length,
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>,
    byProvince: Object.fromEntries(PROVINCES.map((p) => [p, 0])) as Record<Province, number>,
  };
  for (const item of items) {
    if (item.category in counts.byCategory) counts.byCategory[item.category] += 1;
    if (item.province in counts.byProvince) counts.byProvince[item.province] += 1;
  }
  return counts;
}

type FeaturedCandidate = Classified & { name: string; cover_image_url: string | null };

const MS_PER_DAY = 86_400_000;

/** A number that changes once a day; used to rotate the Featured selection. */
export function dailyRotation(now: number = Date.now()): number {
  return Math.floor(now / MS_PER_DAY);
}

/**
 * Chooses a varied set of destinations for the Home carousel.
 *
 * There is no "featured" flag in the database, so the set is derived: it
 * walks the provinces in turn and, from each, takes the destination whose
 * category has been shown least so far. The result covers every province
 * before repeating one and mixes categories, instead of showing whatever
 * happens to come first alphabetically.
 *
 * `rotation` shifts both the starting province and the tie-breaks, so the
 * line-up changes from day to day while staying stable within a day.
 * Destinations with a photo are preferred.
 */
export function pickFeatured<T extends FeaturedCandidate>(
  items: readonly T[],
  limit: number,
  rotation: number = dailyRotation(),
): T[] {
  const withPhoto = items.filter((item) => item.cover_image_url);
  const pool = withPhoto.length >= Math.min(limit, items.length) ? withPhoto : items;

  const remaining = new Map<Province, T[]>();
  for (const province of PROVINCES) {
    const inProvince = pool
      .filter((item) => item.province === province)
      .sort((a, b) => a.name.localeCompare(b.name));
    if (inProvince.length > 0) remaining.set(province, inProvince);
  }

  const turn = ((rotation % PROVINCES.length) + PROVINCES.length) % PROVINCES.length;
  const order = [...PROVINCES.slice(turn), ...PROVINCES.slice(0, turn)];
  const shown = new Map<Category, number>();
  const picked: T[] = [];

  while (picked.length < limit && remaining.size > 0) {
    for (const province of order) {
      if (picked.length >= limit) break;
      const candidates = remaining.get(province);
      if (!candidates) continue;

      const leastShown = Math.min(...candidates.map((item) => shown.get(item.category) ?? 0));
      const best = candidates.filter((item) => (shown.get(item.category) ?? 0) === leastShown);
      const choice = best[Math.abs(rotation) % best.length] ?? best[0];
      if (!choice) continue;

      picked.push(choice);
      shown.set(choice.category, (shown.get(choice.category) ?? 0) + 1);
      const rest = candidates.filter((item) => item !== choice);
      if (rest.length > 0) remaining.set(province, rest);
      else remaining.delete(province);
    }
  }
  return picked;
}
