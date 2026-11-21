/**
 * Heritage Insights (Run 6): every visit, attempt and rating, counted on the
 * phone. Saved for offline use like the catalogue.
 */
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadCatalogue } from '@/hooks/useDestinations';
import { catalogueCache } from '@/lib/appCache';
import { computeInsights } from '@/lib/insights';
import { progressRepository, ratingsRepository } from '@/repositories';

export function useInsights() {
  return useAsyncData('insights', async () => {
    const [destinations, rows] = await Promise.all([
      loadCatalogue(),
      catalogueCache.load('insights-rows', async () => {
        const [completions, attempts, ratings] = await Promise.all([
          progressRepository.listAllCompletions(),
          progressRepository.listAllAttempts(),
          ratingsRepository.listAll(),
        ]);
        return { completions, attempts, ratings };
      }),
    ]);
    return computeInsights({ destinations, ...rows });
  });
}
