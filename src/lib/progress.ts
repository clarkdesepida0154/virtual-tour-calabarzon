/**
 * Turns a learner's raw progress rows into what the Progress tab shows.
 * Pure — no React Native imports — so it can be tested in Node.
 */
import { PROVINCES } from '@/constants/taxonomy';
import type { Province } from '@/constants/taxonomy';
import { bestAttempt, toPercent } from '@/lib/quiz';
import type { DestinationCompletion, DestinationSummary, QuizAttempt } from '@/types/database';

export type BestScore = { score: number; total: number; percent: number };

export type DestinationProgress = {
  destination: DestinationSummary;
  visited: boolean;
  visitedAt: string | null;
  attempts: number;
  best: BestScore | null;
  /** Most recent activity (visit or quiz), for sorting the list. */
  lastActivity: string;
};

export type ProvinceProgress = {
  province: Province;
  visited: number;
  total: number;
};

export type ProgressSummary = {
  totalDestinations: number;
  visitedCount: number;
  quizzesTaken: number;
  /** Mean percentage over every attempt, or null before the first quiz. */
  averagePercent: number | null;
  /** The single best attempt, or null before the first quiz. */
  best: BestScore | null;
  provinces: ProvinceProgress[];
  /** Destinations with any activity, most recent first. */
  journey: DestinationProgress[];
};

/** Best score per destination id. */
export function bestScoresByDestination(
  attempts: readonly Pick<QuizAttempt, 'destination_id' | 'score' | 'total' | 'taken_at'>[],
): Map<string, BestScore> {
  const grouped = new Map<string, (typeof attempts)[number][]>();
  for (const attempt of attempts) {
    const list = grouped.get(attempt.destination_id) ?? [];
    list.push(attempt);
    grouped.set(attempt.destination_id, list);
  }
  const result = new Map<string, BestScore>();
  for (const [destinationId, list] of grouped) {
    const best = bestAttempt(list);
    if (best) {
      result.set(destinationId, {
        score: best.score,
        total: best.total,
        percent: toPercent(best.score, best.total),
      });
    }
  }
  return result;
}

export function summarizeProgress(
  destinations: readonly DestinationSummary[],
  completions: readonly Pick<DestinationCompletion, 'destination_id' | 'completed_at'>[],
  attempts: readonly Pick<QuizAttempt, 'destination_id' | 'score' | 'total' | 'taken_at'>[],
): ProgressSummary {
  const known = new Set(destinations.map((destination) => destination.id));
  // Ignore rows for destinations that no longer exist in the catalogue.
  const liveCompletions = completions.filter((row) => known.has(row.destination_id));
  const liveAttempts = attempts.filter((row) => known.has(row.destination_id));

  const visitedAt = new Map(liveCompletions.map((row) => [row.destination_id, row.completed_at]));
  const bests = bestScoresByDestination(liveAttempts);

  const attemptCount = new Map<string, number>();
  const lastQuiz = new Map<string, string>();
  for (const attempt of liveAttempts) {
    attemptCount.set(attempt.destination_id, (attemptCount.get(attempt.destination_id) ?? 0) + 1);
    const at = attempt.taken_at ?? '';
    if (at > (lastQuiz.get(attempt.destination_id) ?? '')) lastQuiz.set(attempt.destination_id, at);
  }

  const journey: DestinationProgress[] = destinations
    .filter((destination) => visitedAt.has(destination.id) || attemptCount.has(destination.id))
    .map((destination) => {
      const visited = visitedAt.has(destination.id);
      const visitTime = visitedAt.get(destination.id) ?? null;
      const quizTime = lastQuiz.get(destination.id) ?? '';
      return {
        destination,
        visited,
        visitedAt: visitTime,
        attempts: attemptCount.get(destination.id) ?? 0,
        best: bests.get(destination.id) ?? null,
        lastActivity: (visitTime ?? '') > quizTime ? (visitTime ?? '') : quizTime,
      };
    })
    .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity) || a.destination.name.localeCompare(b.destination.name));

  const provinces = PROVINCES.map((province) => {
    const inProvince = destinations.filter((destination) => destination.province === province);
    return {
      province,
      total: inProvince.length,
      visited: inProvince.filter((destination) => visitedAt.has(destination.id)).length,
    };
  });

  const best = bestAttempt(liveAttempts);
  const averagePercent =
    liveAttempts.length > 0
      ? Math.round(
          liveAttempts.reduce((sum, attempt) => sum + toPercent(attempt.score, attempt.total), 0) /
            liveAttempts.length,
        )
      : null;

  return {
    totalDestinations: destinations.length,
    visitedCount: visitedAt.size,
    quizzesTaken: liveAttempts.length,
    averagePercent,
    best: best ? { score: best.score, total: best.total, percent: toPercent(best.score, best.total) } : null,
    provinces,
    journey,
  };
}
