/**
 * Badges and certificates (Run 6), derived from the current user's visits,
 * quiz attempts and favorites — no table of their own.
 */
import { PROVINCES } from '@/constants/taxonomy';
import type { Province } from '@/constants/taxonomy';
import { useIdentity } from '@/context/IdentityContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadCatalogue } from '@/hooks/useDestinations';
import { evaluateBadges } from '@/lib/achievements';
import type { AchievementInput } from '@/lib/achievements';
import { qualifyingCertificates } from '@/lib/certificate';
import { favoritesRepository, progressRepository } from '@/repositories';

/** Everything the badge rules need, for one user key. */
export async function loadAchievementInput(userKey: string): Promise<AchievementInput> {
  const [destinations, completions, attempts, favorites] = await Promise.all([
    loadCatalogue(),
    progressRepository.listCompletions(userKey),
    progressRepository.listAttempts(userKey),
    favoritesRepository.list(userKey),
  ]);
  return { destinations, completions, attempts, favorites };
}

/** Badge statuses + earned certificates for the current user. */
export function useAchievements() {
  const { userKey } = useIdentity();
  return useAsyncData(
    `achievements:${userKey}`,
    async () => {
      const input = await loadAchievementInput(userKey);
      return {
        badges: evaluateBadges(input),
        certificates: qualifyingCertificates(input.destinations, input.completions),
        destinationCount: input.destinations.length,
        provinceCounts: Object.fromEntries(
          PROVINCES.map((province) => [
            province,
            input.destinations.filter((destination) => destination.province === province).length,
          ]),
        ) as Record<Province, number>,
      };
    },
    { keepPreviousData: false },
  );
}
