/**
 * Data hooks for the Phase 2 features: quiz questions, the learner's
 * progress, and map pins. Like useDestinations.ts, each wraps a repository
 * call with loading / error / refresh state, and refetches after any write
 * reported through DataSyncContext. Progress hooks are keyed by the current
 * user key, so they reload by themselves after sign-in or sign-out.
 */
import { useIdentity } from '@/context/IdentityContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { bestScoresByDestination, summarizeProgress } from '@/lib/progress';
import type { BestScore } from '@/lib/progress';
import { destinationsRepository, progressRepository, quizRepository } from '@/repositories';

/** A destination's quiz (questions in order; options NOT yet shuffled). */
export function useQuiz(destinationId: string) {
  return useAsyncData(`quiz:${destinationId}`, () => quizRepository.getForDestination(destinationId), {
    keepPreviousData: false,
  });
}

export type DestinationProgressState = {
  visited: boolean;
  visitedAt: string | null;
  attempts: number;
  best: BestScore | null;
};

/** Whether the current user has visited one destination, and their best quiz score. */
export function useDestinationProgress(destinationId: string) {
  const { userKey } = useIdentity();
  return useAsyncData(
    `destination-progress:${userKey}:${destinationId}`,
    async (): Promise<DestinationProgressState> => {
      const [completion, attempts] = await Promise.all([
        progressRepository.getCompletion(userKey, destinationId),
        progressRepository.listAttempts(userKey, destinationId),
      ]);
      return {
        visited: completion !== null,
        visitedAt: completion?.completed_at ?? null,
        attempts: attempts.length,
        best: bestScoresByDestination(attempts).get(destinationId) ?? null,
      };
    },
    { keepPreviousData: false },
  );
}

/** Everything the Progress tab shows, for the current user. */
export function useProgressSummary() {
  const { userKey } = useIdentity();
  return useAsyncData(
    `progress:${userKey}`,
    async () => {
      const [destinations, completions, attempts] = await Promise.all([
        destinationsRepository.list(),
        progressRepository.listCompletions(userKey),
        progressRepository.listAttempts(userKey),
      ]);
      return summarizeProgress(destinations, completions, attempts);
    },
    { keepPreviousData: false },
  );
}

/** Every destination with coordinates, for the Map tab. */
export function useMapPins() {
  return useAsyncData('map-pins', () => destinationsRepository.listPins());
}
