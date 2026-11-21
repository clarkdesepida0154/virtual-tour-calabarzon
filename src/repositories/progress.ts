/**
 * Progress repository — quiz attempts and visited destinations.
 *
 * Every row is keyed by a "user key" stored in the `device_id` column:
 *   - a signed-in user's Supabase auth user id, or
 *   - for a guest, a random device UUID kept in AsyncStorage.
 * See IdentityContext. The unique (destination_id, device_id) constraint on
 * destination_completions makes "mark as visited" idempotent per user key.
 *
 * A factory, so scripts/verify-crud.mjs runs the same code in Node.
 * No React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/lib/errors';
import { findTransferConflicts } from '@/lib/favorites';
import type { Database, DestinationCompletion, QuizAttempt } from '@/types/database';

export function createProgressRepository(client: SupabaseClient<Database>) {
  /** Saves one finished quiz. Every attempt is kept; the best is derived. */
  async function recordAttempt(input: {
    userKey: string;
    destinationId: string;
    score: number;
    total: number;
  }): Promise<QuizAttempt> {
    const { data, error } = await client
      .from('quiz_attempts')
      .insert({
        device_id: input.userKey,
        destination_id: input.destinationId,
        score: input.score,
        total: input.total,
      })
      .select()
      .single();
    if (error) throw toAppError(error, 'saveScore');
    return data;
  }

  /**
   * Marks a destination as visited. Safe to call again: a second call keeps
   * the first visit (and its date) and returns it.
   */
  async function markVisited(userKey: string, destinationId: string): Promise<DestinationCompletion> {
    const { error } = await client
      .from('destination_completions')
      .upsert(
        { device_id: userKey, destination_id: destinationId },
        { onConflict: 'destination_id,device_id', ignoreDuplicates: true },
      );
    if (error) throw toAppError(error, 'markVisited');

    const existing = await getCompletion(userKey, destinationId);
    if (!existing) throw toAppError(new Error('missing row'), 'markVisited');
    return existing;
  }

  async function getCompletion(userKey: string, destinationId: string): Promise<DestinationCompletion | null> {
    const { data, error } = await client
      .from('destination_completions')
      .select('*')
      .eq('device_id', userKey)
      .eq('destination_id', destinationId)
      .maybeSingle();
    if (error) throw toAppError(error, 'loadProgress');
    return data;
  }

  async function listCompletions(userKey: string): Promise<DestinationCompletion[]> {
    const { data, error } = await client
      .from('destination_completions')
      .select('*')
      .eq('device_id', userKey)
      .order('completed_at', { ascending: false });
    if (error) throw toAppError(error, 'loadProgress');
    return data;
  }

  /** All attempts by this user, newest first; optionally for one destination. */
  async function listAttempts(userKey: string, destinationId?: string): Promise<QuizAttempt[]> {
    let query = client.from('quiz_attempts').select('*').eq('device_id', userKey);
    if (destinationId) query = query.eq('destination_id', destinationId);
    const { data, error } = await query.order('taken_at', { ascending: false });
    if (error) throw toAppError(error, 'loadScores');
    return data;
  }

  /**
   * Every visit in the database, across all users — destination and date
   * only (Heritage Insights; tiny volumes, counted on the phone).
   */
  async function listAllCompletions(): Promise<Pick<DestinationCompletion, 'destination_id' | 'completed_at'>[]> {
    const { data, error } = await client.from('destination_completions').select('destination_id, completed_at');
    if (error) throw toAppError(error, 'loadInsights');
    return data;
  }

  /** Every quiz attempt in the database, across all users — scores only (Heritage Insights). */
  async function listAllAttempts(): Promise<Pick<QuizAttempt, 'destination_id' | 'score' | 'total' | 'taken_at'>[]> {
    const { data, error } = await client.from('quiz_attempts').select('destination_id, score, total, taken_at');
    if (error) throw toAppError(error, 'loadInsights');
    return data;
  }

  /** `id` + `destination_id` of every row a user key has in a unique-per-place table. */
  async function keyedRows(table: 'destination_completions' | 'favorites' | 'ratings', userKey: string) {
    const { data, error } = await client.from(table).select('id, destination_id').eq('device_id', userKey);
    if (error) throw toAppError(error, 'transferProgress');
    return data;
  }

  /**
   * Moves a guest's progress — visits, quiz attempts, favorites and (Run 6)
   * ratings — onto a newly created account, so nothing is lost when a guest
   * signs up. Visits, favorites and ratings the account already has are kept
   * as they are (the guest copy is dropped instead of breaking the unique
   * rule).
   */
  async function transferProgress(fromKey: string, toKey: string): Promise<void> {
    if (!fromKey || !toKey || fromKey === toKey) return;

    const [guestVisits, accountVisits, guestFavorites, accountFavorites, guestRatings, accountRatings] =
      await Promise.all([
        keyedRows('destination_completions', fromKey),
        keyedRows('destination_completions', toKey),
        keyedRows('favorites', fromKey),
        keyedRows('favorites', toKey),
        keyedRows('ratings', fromKey),
        keyedRows('ratings', toKey),
      ]);
    const duplicateVisits = findTransferConflicts(guestVisits, accountVisits).map((row) => row.id);
    const duplicateFavorites = findTransferConflicts(guestFavorites, accountFavorites).map((row) => row.id);
    const duplicateRatings = findTransferConflicts(guestRatings, accountRatings).map((row) => row.id);
    const cleanup = await Promise.all([
      duplicateVisits.length > 0
        ? client.from('destination_completions').delete().in('id', duplicateVisits)
        : null,
      duplicateFavorites.length > 0 ? client.from('favorites').delete().in('id', duplicateFavorites) : null,
      duplicateRatings.length > 0 ? client.from('ratings').delete().in('id', duplicateRatings) : null,
    ]);
    const cleanupError = cleanup.find((result) => result?.error)?.error;
    if (cleanupError) throw toAppError(cleanupError, 'transferProgress');

    const moved = await Promise.all([
      client.from('destination_completions').update({ device_id: toKey }).eq('device_id', fromKey),
      client.from('quiz_attempts').update({ device_id: toKey }).eq('device_id', fromKey),
      client.from('favorites').update({ device_id: toKey }).eq('device_id', fromKey),
      client.from('ratings').update({ device_id: toKey }).eq('device_id', fromKey),
    ]);
    const error = moved.find((result) => result.error)?.error;
    if (error) throw toAppError(error, 'transferProgress');
  }

  /** Removes every progress row, favorite and rating of one user key (used by the test scripts). */
  async function removeAllFor(userKey: string): Promise<void> {
    const results = await Promise.all([
      client.from('destination_completions').delete().eq('device_id', userKey),
      client.from('quiz_attempts').delete().eq('device_id', userKey),
      client.from('favorites').delete().eq('device_id', userKey),
      client.from('ratings').delete().eq('device_id', userKey),
    ]);
    const error = results.find((result) => result.error)?.error;
    if (error) throw toAppError(error, 'clearProgress');
  }

  return {
    recordAttempt,
    markVisited,
    getCompletion,
    listCompletions,
    listAttempts,
    listAllCompletions,
    listAllAttempts,
    transferProgress,
    removeAllFor,
  };
}

export type ProgressRepository = ReturnType<typeof createProgressRepository>;
