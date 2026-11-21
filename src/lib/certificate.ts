/**
 * Certificates of completion (Run 6): who qualifies, for what, and since
 * when. A province certificate needs every destination of that province
 * visited; the region certificate ("CALABARZON Heritage Explorer") needs
 * every destination in the catalogue. Pure — unit-tested in Node.
 */
import { PROVINCES, isProvince } from '@/constants/taxonomy';
import type { Province } from '@/constants/taxonomy';
import type { DestinationCompletion, DestinationSummary } from '@/types/database';

export type CertificateScope = Province | 'region';

export type Certificate = {
  scope: CertificateScope;
  /** Visit time of the place that completed the set. */
  earnedAt: string | null;
  /** How many destinations it covers. */
  count: number;
};

/** Every certificate the learner has earned, provinces first (in the usual order), then the region. */
export function qualifyingCertificates(
  destinations: readonly Pick<DestinationSummary, 'id' | 'province'>[],
  completions: readonly Pick<DestinationCompletion, 'destination_id' | 'completed_at'>[],
): Certificate[] {
  const visited = new Map<string, string | null>();
  for (const row of completions) {
    const previous = visited.get(row.destination_id);
    if (previous === undefined || (row.completed_at ?? '') < (previous ?? '')) {
      visited.set(row.destination_id, row.completed_at);
    }
  }

  const check = (ids: string[]): { ok: boolean; earnedAt: string | null } => {
    if (ids.length === 0 || !ids.every((id) => visited.has(id))) return { ok: false, earnedAt: null };
    const latest = ids.map((id) => visited.get(id) ?? '').sort().at(-1) || null;
    return { ok: true, earnedAt: latest };
  };

  const result: Certificate[] = [];
  for (const province of PROVINCES) {
    const ids = destinations.filter((d) => d.province === province).map((d) => d.id);
    const { ok, earnedAt } = check(ids);
    if (ok) result.push({ scope: province, earnedAt, count: ids.length });
  }
  const all = destinations.map((d) => d.id);
  const region = check(all);
  if (region.ok) result.push({ scope: 'region', earnedAt: region.earnedAt, count: all.length });
  return result;
}

/** Reads a `?scope=` route value; anything unknown → null. */
export function parseScope(value: unknown): CertificateScope | null {
  if (value === 'region') return 'region';
  return isProvince(value) ? value : null;
}

/**
 * The name printed on the certificate: the name the person typed (saved on
 * the phone), else the part of their email before the @, else `fallback`.
 */
export function holderName(savedName: string | null | undefined, email: string | null | undefined, fallback: string): string {
  const typed = (savedName ?? '').trim().replace(/\s+/g, ' ');
  if (typed) return typed.slice(0, MAX_HOLDER_NAME);
  const prefix = (email ?? '').split('@')[0]?.trim() ?? '';
  return prefix ? prefix.slice(0, MAX_HOLDER_NAME) : fallback;
}

export const MAX_HOLDER_NAME = 40;
