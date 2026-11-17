/**
 * Data hooks used by the screens. Each one wraps a repository call with
 * loading / error / refresh state — screens never call the repositories for
 * reads, and never see supabase-js at all.
 */
import { useAsyncData } from '@/hooks/useAsyncData';
import { destinationsRepository } from '@/repositories';
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

/** Everything the Home screen needs, in one round trip pair. */
export function useHomeData() {
  return useAsyncData('home', async () => {
    const [featured, counts] = await Promise.all([
      destinationsRepository.listFeatured(FEATURED_COUNT),
      destinationsRepository.counts(),
    ]);
    return { featured, counts };
  });
}
