/**
 * Ratings repository (Run 6) — 1–5 stars per destination per user key.
 *
 * Rows are keyed by the same user key as the progress tables (`device_id`).
 * The unique (destination_id, device_id) rule makes `rate()` an upsert: a
 * second rating by the same person replaces the first.
 *
 * A factory, so scripts/verify-crud.mjs runs the same code in Node.
 * No React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/lib/errors';
import { clampStars } from '@/lib/ratings';
import type { Database, Rating } from '@/types/database';

const TABLE = 'ratings';

/** The columns the averages need — never the user keys of other people. */
export type RatingRow = Pick<Rating, 'destination_id' | 'stars'>;

export function createRatingsRepository(client: SupabaseClient<Database>) {
  /** Saves (or replaces) this user's rating of a destination. */
  async function rate(userKey: string, destinationId: string, stars: number): Promise<Rating> {
    const { data, error } = await client
      .from(TABLE)
      .upsert(
        { device_id: userKey, destination_id: destinationId, stars: clampStars(stars) },
        { onConflict: 'destination_id,device_id' },
      )
      .select()
      .single();
    if (error) throw toAppError(error, 'saveRating');
    return data;
  }

  /** This user's rating of one destination, or null. */
  async function getMine(userKey: string, destinationId: string): Promise<Rating | null> {
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('device_id', userKey)
      .eq('destination_id', destinationId)
      .maybeSingle();
    if (error) throw toAppError(error, 'loadRatings');
    return data;
  }

  /** Every rating of one destination (stars only). */
  async function listForDestination(destinationId: string): Promise<RatingRow[]> {
    const { data, error } = await client
      .from(TABLE)
      .select('destination_id, stars')
      .eq('destination_id', destinationId);
    if (error) throw toAppError(error, 'loadRatings');
    return data;
  }

  /** Every rating in the database (stars only) — tiny volumes, averaged on the phone. */
  async function listAll(): Promise<RatingRow[]> {
    const { data, error } = await client.from(TABLE).select('destination_id, stars');
    if (error) throw toAppError(error, 'loadRatings');
    return data;
  }

  /** Every rating a user key has given. */
  async function listMine(userKey: string): Promise<Rating[]> {
    const { data, error } = await client.from(TABLE).select('*').eq('device_id', userKey);
    if (error) throw toAppError(error, 'loadRatings');
    return data;
  }

  /** Removes this user's rating of a destination (used by the test scripts). */
  async function remove(userKey: string, destinationId: string): Promise<void> {
    const { error } = await client.from(TABLE).delete().eq('device_id', userKey).eq('destination_id', destinationId);
    if (error) throw toAppError(error, 'saveRating');
  }

  return { rate, getMine, listForDestination, listAll, listMine, remove };
}

export type RatingsRepository = ReturnType<typeof createRatingsRepository>;
