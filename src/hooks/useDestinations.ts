/**
 * Data hooks used by the screens. Each one wraps a repository call with
 * loading / error / refresh state — screens never call the repositories for
 * reads, and never see supabase-js at all.
 */
import { useAsyncData } from '@/hooks/useAsyncData';
import { countDestinations, pickFeatured } from '@/lib/featured';
import { destinationImagesRepository, destinationsRepository } from '@/repositories';
import type { DestinationFilters } from '@/repositories';

const FEATURED_COUNT = 6;

/** The Explore list for the given search + filters. */
export function useDestinations(filters: DestinationFilters) {
  const search = filters.search?.trim() ?? '';
  const key = JSON.stringify(['destinations', search, filters.category, filters.province]);

  return useAsyncData(key, () =>
    destinationsRepository.list({
      search,
      category: filters.category,
      province: filters.province,
    }),
  );
}

/** One destination; `data` is `null` when it does not exist. */
export function useDestination(id: string) {
  return useAsyncData(`destination:${id}`, () => destinationsRepository.getById(id), {
    keepPreviousData: false,
  });
}

/** A destination's photos (cover first), with their credit lines. */
export function useDestinationImages(id: string) {
  return useAsyncData(
    `destination-images:${id}`,
    () => destinationImagesRepository.listForDestination(id),
    { keepPreviousData: false },
  );
}

/**
 * Everything the Home screen needs from one light query: the Featured
 * line-up and how many destinations each category and province has.
 */
export function useHomeData() {
  return useAsyncData('home', async () => {
    const all = await destinationsRepository.list();
    return {
      featured: pickFeatured(all, FEATURED_COUNT),
      counts: countDestinations(all),
    };
  });
}
