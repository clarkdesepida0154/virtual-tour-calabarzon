/**
 * Offline resilience for the catalogue, kept deliberately small: every
 * successful catalogue read is saved; when a later read fails because the
 * phone is offline, the saved copy is served instead of an error. There is no
 * sync engine — writes still need a connection.
 *
 * Pure: the key-value store is injected (AsyncStorage in the app, a Map in the
 * unit tests), so no React Native imports here. The app binding lives in
 * src/lib/appCache.ts.
 */
import { toAppError } from '@/lib/errors';
import type { Category, Province } from '@/constants/taxonomy';
import type { DestinationSummary } from '@/types/database';

export type KeyValueStore = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type DataSource = 'network' | 'cache';

type Entry<T> = { savedAt: string; value: T };

/** True when the failure means "no connection" (rather than a server or data error). */
export function isOfflineError(error: unknown): boolean {
  return toAppError(error, 'generic').kind === 'network';
}

export type OfflineCacheOptions = {
  prefix?: string;
  /** Told whether each load was answered by the network or by the saved copy. */
  onSource?: (source: DataSource) => void;
  now?: () => Date;
};

export function createOfflineCache(
  store: KeyValueStore,
  { prefix = 'vtour.cache.', onSource, now = () => new Date() }: OfflineCacheOptions = {},
) {
  /** The saved value for `key`, or `null` (also when storage fails or the entry is corrupt). */
  async function read<T>(key: string): Promise<T | null> {
    try {
      const raw = await store.getItem(prefix + key);
      if (!raw) return null;
      const entry = JSON.parse(raw) as Partial<Entry<T>>;
      return entry && 'value' in entry && entry.value !== undefined ? (entry.value as T) : null;
    } catch {
      return null;
    }
  }

  /** Saves `value` under `key`. Storage errors are swallowed: the cache is a bonus. */
  async function write<T>(key: string, value: T): Promise<void> {
    try {
      const entry: Entry<T> = { savedAt: now().toISOString(), value };
      await store.setItem(prefix + key, JSON.stringify(entry));
    } catch {
      // Full or unavailable storage only means no offline copy.
    }
  }

  /**
   * Runs `fetcher`. On success the result is saved under `key` and returned.
   * On an offline error, `fallback` (default: the copy saved under `key`)
   * answers instead. Any other error — or offline with nothing saved — is
   * rethrown so the screen shows its normal error state.
   */
  async function load<T>(
    key: string | null,
    fetcher: () => Promise<T>,
    fallback?: () => Promise<T | null>,
  ): Promise<T> {
    let value: T;
    try {
      value = await fetcher();
    } catch (error) {
      if (!isOfflineError(error)) throw error;
      const saved = fallback ? await fallback() : key ? await read<T>(key) : null;
      if (saved === null) throw error;
      onSource?.('cache');
      return saved;
    }
    if (key) await write(key, value);
    onSource?.('network');
    return value;
  }

  return { read, write, load };
}

export type OfflineCache = ReturnType<typeof createOfflineCache>;

/** Cache keys for the catalogue. */
export const CACHE_KEYS = {
  /** The whole catalogue as summaries (Home, Explore, Map all derive from it offline). */
  catalogue: 'catalogue',
  destination: (id: string) => `destination:${id}`,
  images: (id: string) => `destination-images:${id}`,
} as const;

/**
 * The same search + filters as the server query, applied to a saved list —
 * so Explore still filters while offline. Case-insensitive partial match on
 * name and municipality, A–Z.
 */
export function filterSummaries<T extends Pick<DestinationSummary, 'name' | 'municipality' | 'category' | 'province'>>(
  list: readonly T[],
  filters: { search?: string; category?: Category | null; province?: Province | null },
): T[] {
  const term = (filters.search ?? '').trim().toLowerCase();
  return list
    .filter((item) => !filters.category || item.category === filters.category)
    .filter((item) => !filters.province || item.province === filters.province)
    .filter(
      (item) =>
        !term ||
        item.name.toLowerCase().includes(term) ||
        (item.municipality ?? '').toLowerCase().includes(term),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
}
