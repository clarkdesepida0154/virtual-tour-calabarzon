/**
 * Heritage Insights (Run 6) — community-level statistics computed on the
 * phone from every visit, quiz attempt and rating (the volumes are tiny).
 * No user keys are involved: only destination ids, scores and stars.
 * Pure — unit-tested in Node.
 */
import { CATEGORIES, PROVINCES } from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';
import { toPercent } from '@/lib/quiz';
import { roundToTenth, summarizeRatings } from '@/lib/ratings';
import type { DestinationCompletion, DestinationSummary, QuizAttempt } from '@/types/database';

export const TOP_N = 5;

export type RankedDestination<T> = { destination: T; value: number; count: number };

export type Insights<T> = {
  totals: { visits: number; attempts: number; ratings: number };
  /** Top 5 by number of visits (completions). */
  mostVisited: RankedDestination<T>[];
  /** Top 5 by average stars (at least one rating); value = average, count = ratings. */
  topRated: RankedDestination<T>[];
  /** Lowest average quiz score first (at least one attempt); value = average %, count = attempts. */
  toughestQuizzes: RankedDestination<T>[];
  visitsByProvince: { province: Province; visits: number }[];
  visitsByCategory: { category: Category; visits: number }[];
  isEmpty: boolean;
};

export function computeInsights<T extends Pick<DestinationSummary, 'id' | 'name' | 'province' | 'category'>>(input: {
  destinations: readonly T[];
  completions: readonly Pick<DestinationCompletion, 'destination_id'>[];
  attempts: readonly Pick<QuizAttempt, 'destination_id' | 'score' | 'total'>[];
  ratings: readonly { destination_id: string; stars: number }[];
}): Insights<T> {
  const byId = new Map(input.destinations.map((destination) => [destination.id, destination]));
  const completions = input.completions.filter((row) => byId.has(row.destination_id));
  const attempts = input.attempts.filter((row) => byId.has(row.destination_id) && row.total > 0);
  const ratings = input.ratings.filter((row) => byId.has(row.destination_id));

  const visitCounts = new Map<string, number>();
  for (const row of completions) visitCounts.set(row.destination_id, (visitCounts.get(row.destination_id) ?? 0) + 1);

  const byName = (a: RankedDestination<T>, b: RankedDestination<T>) => a.destination.name.localeCompare(b.destination.name);

  const mostVisited = [...visitCounts.entries()]
    .map(([id, count]) => ({ destination: byId.get(id)!, value: count, count }))
    .sort((a, b) => b.value - a.value || byName(a, b))
    .slice(0, TOP_N);

  const topRated = Object.entries(summarizeRatings(ratings))
    .map(([id, summary]) => ({ destination: byId.get(id)!, value: summary.average, count: summary.count }))
    .sort((a, b) => b.value - a.value || b.count - a.count || byName(a, b))
    .slice(0, TOP_N);

  const scoreSums = new Map<string, { percent: number; count: number }>();
  for (const row of attempts) {
    const entry = scoreSums.get(row.destination_id) ?? { percent: 0, count: 0 };
    entry.percent += toPercent(row.score, row.total);
    entry.count += 1;
    scoreSums.set(row.destination_id, entry);
  }
  const toughestQuizzes = [...scoreSums.entries()]
    .map(([id, { percent, count }]) => ({ destination: byId.get(id)!, value: roundToTenth(percent / count), count }))
    .sort((a, b) => a.value - b.value || b.count - a.count || byName(a, b))
    .slice(0, TOP_N);

  const visitsByProvince = PROVINCES.map((province) => ({
    province,
    visits: completions.filter((row) => byId.get(row.destination_id)!.province === province).length,
  }));
  const visitsByCategory = CATEGORIES.map((category) => ({
    category,
    visits: completions.filter((row) => byId.get(row.destination_id)!.category === category).length,
  }));

  return {
    totals: { visits: completions.length, attempts: attempts.length, ratings: ratings.length },
    mostVisited,
    topRated,
    toughestQuizzes,
    visitsByProvince,
    visitsByCategory,
    isEmpty: completions.length === 0 && attempts.length === 0 && ratings.length === 0,
  };
}

/** Bar length (0–1) of `value` against the largest value in the list. */
export function barShare(value: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
}
