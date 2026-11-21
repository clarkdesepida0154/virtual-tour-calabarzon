/**
 * Star ratings (Run 6). Reads go through the offline cache, so the averages
 * still show (as last saved) when the phone is offline.
 */
import { useIdentity } from '@/context/IdentityContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { catalogueCache } from '@/lib/appCache';
import { summarizeRatings, summarizeStars } from '@/lib/ratings';
import type { RatingSummary } from '@/lib/ratings';
import { ratingsRepository } from '@/repositories';

/** Average + count for every rated destination (Explore cards). */
export function useRatingSummaries() {
  return useAsyncData('ratings-summary', () =>
    catalogueCache.load('ratings-summary', async () => summarizeRatings(await ratingsRepository.listAll())),
  );
}

export type DestinationRatingState = {
  summary: RatingSummary | null;
  /** The current user's stars, or null. */
  mine: number | null;
};

/** One destination's average and the current user's own rating (Details). */
export function useDestinationRating(destinationId: string) {
  const { userKey } = useIdentity();
  return useAsyncData(
    `rating:${userKey}:${destinationId}`,
    () =>
      catalogueCache.load(`rating:${userKey}:${destinationId}`, async (): Promise<DestinationRatingState> => {
        const [rows, mine] = await Promise.all([
          ratingsRepository.listForDestination(destinationId),
          ratingsRepository.getMine(userKey, destinationId),
        ]);
        return { summary: summarizeStars(rows.map((row) => row.stars)), mine: mine?.stars ?? null };
      }),
    { keepPreviousData: false },
  );
}
