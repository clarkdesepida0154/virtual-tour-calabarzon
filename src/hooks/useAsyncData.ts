import { useCallback, useEffect, useEffectEvent, useState } from 'react';

import { useDataSync } from '@/context/DataSyncContext';
import { toAppError } from '@/lib/errors';
import type { AppError } from '@/lib/errors';

export type AsyncStatus = 'loading' | 'error' | 'success';

export type AsyncData<T> = {
  /** The latest result. With `keepPreviousData` it may belong to an older key. */
  data: T | undefined;
  error: AppError | null;
  /** `loading` = nothing to show yet, `error` = last attempt failed. */
  status: AsyncStatus;
  /** True whenever a request is in flight (first load, refetch or refresh). */
  isFetching: boolean;
  /** True only for a pull-to-refresh started with `refresh()`. */
  isRefreshing: boolean;
  refresh: () => void;
  retry: () => void;
};

type Settled<T> = {
  key: string;
  revision: number;
  data: T | undefined;
  error: AppError | null;
};

type Options = {
  /**
   * Keep showing the previous result while a new key loads (good for
   * search-as-you-type). Turn off when a stale result would be wrong.
   */
  keepPreviousData?: boolean;
};

/**
 * Loads data with a repository call and tracks loading / error / refresh.
 *
 * - Refetches when `key` changes, when `retry()`/`refresh()` is called, and
 *   when any screen reports a write through DataSyncContext.
 * - Ignores responses that arrive after a newer request has started.
 * - "Loading" is derived by comparing what was asked for with what has
 *   settled, so no state is set synchronously inside the effect.
 */
export function useAsyncData<T>(
  key: string,
  fetcher: () => Promise<T>,
  { keepPreviousData = true }: Options = {},
): AsyncData<T> {
  const { version } = useDataSync();
  const [reloads, setReloads] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Both counters only ever grow, so their sum changes whenever either does.
  const revision = version + reloads;
  const load = useEffectEvent(fetcher);

  useEffect(() => {
    let isLatest = true;

    load().then(
      (data) => {
        if (!isLatest) return;
        setSettled({ key, revision, data, error: null });
        setIsRefreshing(false);
      },
      (cause: unknown) => {
        if (!isLatest) return;
        setSettled((previous) => ({
          key,
          revision,
          data: previous?.key === key ? previous.data : undefined,
          error: toAppError(cause, 'We couldn’t load this.'),
        }));
        setIsRefreshing(false);
      },
    );

    return () => {
      isLatest = false;
    };
  }, [key, revision]);

  const isCurrent = settled !== null && settled.key === key && settled.revision === revision;
  const canShowSettled = settled !== null && (keepPreviousData || settled.key === key);
  const data = canShowSettled ? settled.data : undefined;
  const error = isCurrent ? settled.error : null;
  const status: AsyncStatus = error ? 'error' : data === undefined ? 'loading' : 'success';

  const retry = useCallback(() => setReloads((count) => count + 1), []);
  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setReloads((count) => count + 1);
  }, []);

  return { data, error, status, isFetching: !isCurrent, isRefreshing, refresh, retry };
}
