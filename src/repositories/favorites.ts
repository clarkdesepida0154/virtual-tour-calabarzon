/**
 * Favorites repository — the destinations a person has "hearted".
 *
 * Rows are keyed by the same user key as the progress tables (`device_id`:
 * the auth user id when signed in, the device UUID for a guest). The unique
 * (destination_id, device_id) rule makes adding idempotent.
 *
 * A factory, so scripts/verify-crud.mjs runs the same code in Node.
 * No React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/lib/errors';
import type { Database, Favorite } from '@/types/database';

const TABLE = 'favorites';

export function createFavoritesRepository(client: SupabaseClient<Database>) {
  /** Every favorite of this user key, newest first. */
  async function list(userKey: string): Promise<Favorite[]> {
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('device_id', userKey)
      .order('created_at', { ascending: false });
    if (error) throw toAppError(error, 'loadFavorites');
    return data;
  }

  /** Saves a favorite. Calling it again for the same place changes nothing. */
  async function add(userKey: string, destinationId: string): Promise<void> {
    const { error } = await client
      .from(TABLE)
      .upsert(
        { device_id: userKey, destination_id: destinationId },
        { onConflict: 'destination_id,device_id', ignoreDuplicates: true },
      );
    if (error) throw toAppError(error, 'saveFavorite');
  }

  /** Removes a favorite. Removing one that is not there is not an error. */
  async function remove(userKey: string, destinationId: string): Promise<void> {
    const { error } = await client
      .from(TABLE)
      .delete()
      .eq('device_id', userKey)
      .eq('destination_id', destinationId);
    if (error) throw toAppError(error, 'removeFavorite');
  }

  /** Adds (`on`) or removes the favorite. */
  async function set(userKey: string, destinationId: string, on: boolean): Promise<void> {
    if (on) await add(userKey, destinationId);
    else await remove(userKey, destinationId);
  }

  return { list, add, remove, set };
}

export type FavoritesRepository = ReturnType<typeof createFavoritesRepository>;
