import { createContext, use, useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { useI18n } from '@/context/I18nContext';
import { useIdentity } from '@/context/IdentityContext';
import { useToast } from '@/context/ToastContext';
import { useAsyncData } from '@/hooks/useAsyncData';
import { tapFeedback } from '@/lib/device';
import { mergeFavoriteChanges } from '@/lib/favorites';
import type { FavoriteChange, FavoriteEntry } from '@/lib/favorites';
import { favoritesRepository } from '@/repositories';

/**
 * The current user's favorites, shared by every heart in the app (cards,
 * Details, the Progress tab) so they always agree.
 *
 * Keyed by `useIdentity().userKey`, like all progress. Toggling is
 * optimistic: the heart fills at once, the write happens in the background,
 * and a failure (e.g. offline) puts the heart back and explains why.
 */
type FavoritesValue = {
  /** False until the first load for this user key has finished. */
  isReady: boolean;
  isFavorite: (destinationId: string) => boolean;
  /** Current favorites, newest first (optimistic changes included). */
  entries: FavoriteEntry[];
  toggle: (destinationId: string, name?: string) => void;
};

const FavoritesContext = createContext<FavoritesValue | null>(null);

/** Optimistic changes not yet confirmed by a reload, for one user key. */
type Pending = { userKey: string; changes: Map<string, FavoriteChange> };

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { userKey, isReady: identityReady } = useIdentity();
  const { showToast } = useToast();
  const { t } = useI18n();
  const query = useAsyncData(
    `favorites:${userKey}`,
    () => (userKey ? favoritesRepository.list(userKey) : Promise.resolve([])),
    { keepPreviousData: false },
  );
  const [pending, setPending] = useState<Pending>({ userKey, changes: new Map() });

  // Changes made under another user key (before sign-in / sign-out) no longer apply.
  const changes = pending.userKey === userKey ? pending.changes : null;
  const serverRows = query.data;
  const reload = query.retry;

  const entries = useMemo(() => mergeFavoriteChanges(serverRows ?? [], changes), [serverRows, changes]);

  const ids = useMemo(() => new Set(entries.map((row) => row.destination_id)), [entries]);

  const setChange = useCallback(
    (key: string, destinationId: string, change: FavoriteChange | null) =>
      setPending((current) => {
        const base = current.userKey === key ? current.changes : new Map<string, FavoriteChange>();
        const next = new Map(base);
        if (change) next.set(destinationId, change);
        else next.delete(destinationId);
        return { userKey: key, changes: next };
      }),
    [],
  );

  const toggle = useCallback(
    (destinationId: string, name = '') => {
      if (!userKey) return;
      const key = userKey;
      const on = !ids.has(destinationId);
      tapFeedback();
      setChange(key, destinationId, { on, at: new Date().toISOString() });
      favoritesRepository.set(key, destinationId, on).then(
        () => reload(),
        () => {
          // Put the heart back the way it was, and say why.
          setChange(key, destinationId, null);
          showToast(t(on ? 'favorites.saveFailed' : 'favorites.removeFailed', { name }));
        },
      );
    },
    [userKey, ids, setChange, reload, showToast, t],
  );

  const value = useMemo<FavoritesValue>(
    () => ({
      isReady: identityReady && query.status !== 'loading',
      isFavorite: (destinationId: string) => ids.has(destinationId),
      entries,
      toggle,
    }),
    [identityReady, query.status, ids, entries, toggle],
  );

  return <FavoritesContext value={value}>{children}</FavoritesContext>;
}

export function useFavorites(): FavoritesValue {
  const value = use(FavoritesContext);
  if (!value) throw new Error('useFavorites must be used inside <FavoritesProvider>.');
  return value;
}
