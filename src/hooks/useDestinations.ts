/**
 * Data hooks used by the screens. Each one wraps a repository call with
 * loading / error / refresh state — screens never call the repositories for
 * reads, and never see supabase-js at all.
 *
 * Catalogue reads go through the offline cache (src/lib/appCache.ts): each
 * success is saved, and when the phone is offline the saved copy answers
 * instead of an error. Filtered Explore results are not saved one by one —
 * offline, the saved full catalogue is filtered on the phone.
 */
import { useAsyncData } from '@/hooks/useAsyncData';
import { catalogueCache } from '@/lib/appCache';
import { groupCredits } from '@/lib/credits';
import { countDestinations, pickFeatured } from '@/lib/featured';
import { hasCoordinates } from '@/lib/mapRegion';
import { CACHE_KEYS, filterSummaries } from '@/lib/offlineCache';
import { destinationImagesRepository, destinationsRepository } from '@/repositories';
import type { DestinationFilters } from '@/repositories';
import type { DestinationPin, DestinationSummary } from '@/types/database';

const FEATURED_COUNT = 6;

/** The whole catalogue as summaries, saved for offline use. */
export function loadCatalogue(): Promise<DestinationSummary[]> {
  return catalogueCache.load(CACHE_KEYS.catalogue, () => destinationsRepository.list());
}

const readSavedCatalogue = () => catalogueCache.read<DestinationSummary[]>(CACHE_KEYS.catalogue);

/** The Explore list for the given search + filters. */
export function useDestinations(filters: DestinationFilters) {
  const search = filters.search?.trim() ?? '';
  const key = JSON.stringify(['destinations', search, filters.category, filters.province]);

  const query = { search, category: filters.category, province: filters.province };
  const isUnfiltered = !search && !filters.category && !filters.province;

  return useAsyncData(key, () =>
    isUnfiltered
      ? loadCatalogue()
      : catalogueCache.load(
          null,
          () => destinationsRepository.list(query),
          async () => {
            const saved = await readSavedCatalogue();
            return saved ? filterSummaries(saved, query) : null;
          },
        ),
  );
}

/** One destination; `data` is `null` when it does not exist. */
export function useDestination(id: string) {
  return useAsyncData(
    `destination:${id}`,
    () => catalogueCache.load(CACHE_KEYS.destination(id), () => destinationsRepository.getById(id)),
    { keepPreviousData: false },
  );
}

/** A destination's photos (cover first), with their credit lines. */
export function useDestinationImages(id: string) {
  return useAsyncData(
    `destination-images:${id}`,
    () =>
      catalogueCache.load(CACHE_KEYS.images(id), () =>
        destinationImagesRepository.listForDestination(id),
      ),
    { keepPreviousData: false },
  );
}

/**
 * Everything the Home screen needs from one light query: the Featured
 * line-up and how many destinations each category and province has.
 */
export function useHomeData() {
  return useAsyncData('home', async () => {
    const all = await loadCatalogue();
    return {
      featured: pickFeatured(all, FEATURED_COUNT),
      counts: countDestinations(all),
    };
  });
}

/** Every destination with coordinates, for the Map tab (offline: from the saved catalogue). */
export function useMapPins() {
  return useAsyncData('map-pins', () =>
    catalogueCache.load(
      null,
      () => destinationsRepository.listPins(),
      async () => {
        const saved = await readSavedCatalogue();
        return saved ? saved.filter((item): item is DestinationPin => hasCoordinates(item)) : null;
      },
    ),
  );
}

/** Every photo credit, grouped by destination (Settings → Photo credits). */
export function usePhotoCredits() {
  return useAsyncData('photo-credits', async () => {
    const [catalogue, images] = await Promise.all([
      loadCatalogue(),
      catalogueCache.load('photo-credits', () => destinationImagesRepository.listAll()),
    ]);
    return groupCredits(catalogue, images);
  });
}
