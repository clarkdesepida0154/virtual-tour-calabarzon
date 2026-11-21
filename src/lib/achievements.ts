/**
 * Achievements & badges (Run 6) — derived entirely from rows the app already
 * stores (visits, quiz attempts, favorites). No table of their own: a badge
 * is earned when its rule holds, and its date is the date of the row that
 * made the rule hold. Pure — no React Native imports — unit-tested in Node.
 *
 * The registry below is the single list of badges; the UI reads its titles
 * and descriptions from `achievements.badges.<id>` in the dictionaries.
 */
import { PROVINCES } from '@/constants/taxonomy';
import type { Province } from '@/constants/taxonomy';
import type { DestinationCompletion, DestinationSummary, Favorite, QuizAttempt } from '@/types/database';

export type BadgeId =
  | 'first-journey'
  | 'explorer-cavite'
  | 'explorer-laguna'
  | 'explorer-batangas'
  | 'explorer-rizal'
  | 'explorer-quezon'
  | 'heritage-scholar'
  | 'quiz-enthusiast'
  | 'collector'
  | 'calabarzon-master';

/** Dictionary slug of each badge (`achievements.badges.<key>`). */
export type BadgeKey =
  | 'firstJourney'
  | 'explorerCavite'
  | 'explorerLaguna'
  | 'explorerBatangas'
  | 'explorerRizal'
  | 'explorerQuezon'
  | 'heritageScholar'
  | 'quizEnthusiast'
  | 'collector'
  | 'calabarzonMaster';

export type BadgeRule =
  | { kind: 'visits'; count: number }
  | { kind: 'province'; province: Province }
  | { kind: 'perfect-quizzes'; count: number }
  | { kind: 'attempts'; count: number }
  | { kind: 'favorites'; count: number }
  | { kind: 'all-visited' };

export type BadgeDefinition = {
  id: BadgeId;
  key: BadgeKey;
  /** Material Community Icons name. */
  icon: string;
  rule: BadgeRule;
  /** Earning it also unlocks a certificate (province or whole region). */
  certificate: Province | 'region' | null;
};

/** Thresholds, in one place. */
export const BADGE_THRESHOLDS = {
  firstJourney: 1,
  perfectQuizzes: 5,
  attempts: 15,
  favorites: 8,
} as const;

const PROVINCE_KEYS: Record<Province, BadgeKey> = {
  Cavite: 'explorerCavite',
  Laguna: 'explorerLaguna',
  Batangas: 'explorerBatangas',
  Rizal: 'explorerRizal',
  Quezon: 'explorerQuezon',
};

const PROVINCE_ICONS: Record<Province, string> = {
  Cavite: 'flag-variant-outline',
  Laguna: 'waves',
  Batangas: 'image-filter-hdr',
  Rizal: 'palette-outline',
  Quezon: 'palm-tree',
};

/** The 10 badges, in display order. */
export const BADGES: readonly BadgeDefinition[] = [
  { id: 'first-journey', key: 'firstJourney', icon: 'shoe-print', rule: { kind: 'visits', count: BADGE_THRESHOLDS.firstJourney }, certificate: null },
  ...PROVINCES.map(
    (province): BadgeDefinition => ({
      id: `explorer-${province.toLowerCase()}` as BadgeId,
      key: PROVINCE_KEYS[province],
      icon: PROVINCE_ICONS[province],
      rule: { kind: 'province', province },
      certificate: province,
    }),
  ),
  { id: 'heritage-scholar', key: 'heritageScholar', icon: 'school-outline', rule: { kind: 'perfect-quizzes', count: BADGE_THRESHOLDS.perfectQuizzes }, certificate: null },
  { id: 'quiz-enthusiast', key: 'quizEnthusiast', icon: 'head-lightbulb-outline', rule: { kind: 'attempts', count: BADGE_THRESHOLDS.attempts }, certificate: null },
  { id: 'collector', key: 'collector', icon: 'heart-multiple-outline', rule: { kind: 'favorites', count: BADGE_THRESHOLDS.favorites }, certificate: null },
  { id: 'calabarzon-master', key: 'calabarzonMaster', icon: 'crown-outline', rule: { kind: 'all-visited' }, certificate: 'region' },
];

export type AchievementInput = {
  destinations: readonly Pick<DestinationSummary, 'id' | 'province'>[];
  completions: readonly Pick<DestinationCompletion, 'destination_id' | 'completed_at'>[];
  attempts: readonly Pick<QuizAttempt, 'destination_id' | 'score' | 'total' | 'taken_at'>[];
  favorites: readonly Pick<Favorite, 'destination_id' | 'created_at'>[];
};

export type BadgeStatus = {
  badge: BadgeDefinition;
  earned: boolean;
  /** ISO time of the qualifying row; null while locked (or when the row has no time). */
  earnedAt: string | null;
  /** How far along: `current` of `target` (capped at target). */
  current: number;
  target: number;
};

const byTime = <T,>(read: (row: T) => string | null | undefined) => (a: T, b: T) =>
  (read(a) ?? '').localeCompare(read(b) ?? '');

/** The time of the `n`-th row (1-based) in time order, or null when there are fewer. */
function nthTime<T>(rows: readonly T[], n: number, read: (row: T) => string | null | undefined): string | null {
  if (n < 1 || rows.length < n) return null;
  return read([...rows].sort(byTime(read))[n - 1]) ?? null;
}

/** Status of every badge for one learner. Rows for deleted destinations are ignored. */
export function evaluateBadges(input: AchievementInput): BadgeStatus[] {
  const known = new Set(input.destinations.map((destination) => destination.id));

  // One visit per destination (the table is unique, but be safe), earliest kept.
  const visitTime = new Map<string, string | null>();
  for (const row of [...input.completions].sort(byTime((r) => r.completed_at))) {
    if (known.has(row.destination_id) && !visitTime.has(row.destination_id)) {
      visitTime.set(row.destination_id, row.completed_at);
    }
  }
  const visits = [...visitTime.entries()].map(([destination_id, completed_at]) => ({ destination_id, completed_at }));
  const attempts = input.attempts.filter((row) => known.has(row.destination_id));
  const favorites = input.favorites.filter((row) => known.has(row.destination_id));

  // First perfect attempt per destination ("5 perfect quizzes" = 5 different places).
  const firstPerfect = new Map<string, string | null>();
  for (const row of [...attempts].sort(byTime((r) => r.taken_at))) {
    if (row.total > 0 && row.score === row.total && !firstPerfect.has(row.destination_id)) {
      firstPerfect.set(row.destination_id, row.taken_at);
    }
  }
  const perfects = [...firstPerfect.values()].map((taken_at) => ({ taken_at }));

  /** Every destination of a group visited → the latest of those visit times. */
  const completedSet = (ids: readonly string[]) => {
    const done = ids.filter((id) => visitTime.has(id));
    const complete = ids.length > 0 && done.length === ids.length;
    const latest = complete
      ? done.map((id) => visitTime.get(id) ?? '').sort().at(-1) || null
      : null;
    return { done: done.length, total: ids.length, complete, latest };
  };

  return BADGES.map((badge): BadgeStatus => {
    const rule = badge.rule;
    switch (rule.kind) {
      case 'visits':
        return status(badge, visits.length, rule.count, nthTime(visits, rule.count, (r) => r.completed_at));
      case 'perfect-quizzes':
        return status(badge, perfects.length, rule.count, nthTime(perfects, rule.count, (r) => r.taken_at));
      case 'attempts':
        return status(badge, attempts.length, rule.count, nthTime(attempts, rule.count, (r) => r.taken_at));
      case 'favorites':
        return status(badge, favorites.length, rule.count, nthTime(favorites, rule.count, (r) => r.created_at));
      case 'province': {
        const ids = input.destinations.filter((d) => d.province === rule.province).map((d) => d.id);
        const set = completedSet(ids);
        return { badge, earned: set.complete, earnedAt: set.latest, current: set.done, target: Math.max(1, set.total) };
      }
      case 'all-visited': {
        const set = completedSet(input.destinations.map((d) => d.id));
        return { badge, earned: set.complete, earnedAt: set.latest, current: set.done, target: Math.max(1, set.total) };
      }
    }
  });
}

function status(badge: BadgeDefinition, current: number, target: number, earnedAt: string | null): BadgeStatus {
  const earned = current >= target;
  return { badge, earned, earnedAt: earned ? earnedAt : null, current: Math.min(current, target), target };
}

/** Badges earned now that are not in `seen` (in registry order). */
export function newlyEarned(statuses: readonly BadgeStatus[], seen: ReadonlySet<string>): BadgeStatus[] {
  return statuses.filter((entry) => entry.earned && !seen.has(entry.badge.id));
}

/** Parses the stored "seen" list (a JSON array of badge ids); anything else → empty. */
export function parseSeenBadges(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export function earnedCount(statuses: readonly BadgeStatus[]): number {
  return statuses.filter((entry) => entry.earned).length;
}
