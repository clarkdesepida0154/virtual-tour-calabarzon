/**
 * Favorites logic that does not need a database: optimistic toggling, the
 * Progress tab's favorites list, and how guest rows merge into an account.
 * Pure — no React Native imports — so it is unit-tested in Node.
 */
import type { DestinationSummary, Favorite } from '@/types/database';

export type FavoriteEntry = Pick<Favorite, 'destination_id' | 'created_at'>;

/** An optimistic change not yet confirmed by the server: added (`on`) or removed, and when. */
export type FavoriteChange = { on: boolean; at: string };

/**
 * The favorites to show: the server rows with the optimistic changes laid on
 * top (removed ones dropped, added ones appended with their time), newest
 * first. Never mutates its inputs.
 */
export function mergeFavoriteChanges(
  serverRows: readonly FavoriteEntry[],
  changes: ReadonlyMap<string, FavoriteChange> | null,
): FavoriteEntry[] {
  const rows = serverRows.filter((row) => changes?.get(row.destination_id)?.on !== false);
  if (changes) {
    const known = new Set(rows.map((row) => row.destination_id));
    for (const [destinationId, change] of changes) {
      if (change.on && !known.has(destinationId)) {
        rows.push({ destination_id: destinationId, created_at: change.at });
        known.add(destinationId);
      }
    }
  }
  return rows.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
}

/**
 * The favorited destinations, most recently saved first. Rows that point to a
 * destination no longer in the catalogue are ignored.
 */
export function favoriteDestinations<T extends Pick<DestinationSummary, 'id' | 'name'>>(
  destinations: readonly T[],
  favorites: readonly Pick<Favorite, 'destination_id' | 'created_at'>[],
): T[] {
  const byId = new Map(destinations.map((destination) => [destination.id, destination]));
  return [...favorites]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .map((row) => byId.get(row.destination_id))
    .filter((destination, index, list): destination is T => {
      // Keep the first (newest) occurrence only, and drop unknown ids.
      return destination !== undefined && list.indexOf(destination) === index;
    });
}

/**
 * Rows a guest has that the account already has too (same destination).
 * They must be deleted before the guest rows are re-keyed to the account,
 * or the unique (destination_id, device_id) rule would reject the move.
 * Works for both `destination_completions` and `favorites`.
 */
export function findTransferConflicts<Row extends { id: string; destination_id: string }>(
  guestRows: readonly Row[],
  accountRows: readonly Pick<Row, 'destination_id'>[],
): Row[] {
  const onAccount = new Set(accountRows.map((row) => row.destination_id));
  return guestRows.filter((row) => onAccount.has(row.destination_id));
}
