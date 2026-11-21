/**
 * Star-rating maths (Run 6). Pure — no React Native imports.
 */
export const MAX_STARS = 5;

export type RatingSummary = {
  /** Mean of every rating, rounded to one decimal (e.g. 4.6). */
  average: number;
  count: number;
};

/** A whole number of stars from 1 to 5. */
export function clampStars(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_STARS, Math.max(1, Math.round(value)));
}

/** Rounds to one decimal the way people expect (4.65 → 4.7, not 4.6 from float error). */
export function roundToTenth(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/** Average + count of a list of star values; null when there are none. */
export function summarizeStars(stars: readonly number[]): RatingSummary | null {
  const valid = stars.filter((value) => Number.isFinite(value) && value >= 1 && value <= MAX_STARS);
  if (valid.length === 0) return null;
  const sum = valid.reduce((total, value) => total + value, 0);
  return { average: roundToTenth(sum / valid.length), count: valid.length };
}

/** Average + count per destination id, from rows of every user. */
export function summarizeRatings(
  rows: readonly { destination_id: string; stars: number }[],
): Record<string, RatingSummary> {
  const grouped = new Map<string, number[]>();
  for (const row of rows) {
    const list = grouped.get(row.destination_id) ?? [];
    list.push(row.stars);
    grouped.set(row.destination_id, list);
  }
  const result: Record<string, RatingSummary> = {};
  for (const [destinationId, stars] of grouped) {
    const summary = summarizeStars(stars);
    if (summary) result[destinationId] = summary;
  }
  return result;
}

/** "4.6" — always one decimal. */
export function formatAverage(average: number): string {
  return roundToTenth(average).toFixed(1);
}
