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
    if (error) throw toAppError(error, 'We couldn’t save your score.');
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
    if (error) throw toAppError(error, 'We couldn’t mark this destination as visited.');

    const existing = await getCompletion(userKey, destinationId);
    if (!existing) throw toAppError(new Error('missing row'), 'We couldn’t mark this destination as visited.');
    return existing;
  }

  async function getCompletion(userKey: string, destinationId: string): Promise<DestinationCompletion | null> {
    const { data, error } = await client
      .from('destination_completions')
      .select('*')
      .eq('device_id', userKey)
      .eq('destination_id', destinationId)
      .maybeSingle();
    if (error) throw toAppError(error, 'We couldn’t load your progress.');
    return data;
  }

  async function listCompletions(userKey: string): Promise<DestinationCompletion[]> {
    const { data, error } = await client
      .from('destination_completions')
      .select('*')
      .eq('device_id', userKey)
      .order('completed_at', { ascending: false });
    if (error) throw toAppError(error, 'We couldn’t load your progress.');
    return data;
  }

  /** All attempts by this user, newest first; optionally for one destination. */
  async function listAttempts(userKey: string, destinationId?: string): Promise<QuizAttempt[]> {
    let query = client.from('quiz_attempts').select('*').eq('device_id', userKey);
    if (destinationId) query = query.eq('destination_id', destinationId);
    const { data, error } = await query.order('taken_at', { ascending: false });
    if (error) throw toAppError(error, 'We couldn’t load your quiz scores.');
    return data;
  }

  /**
   * Moves a guest's progress onto a newly created account, so nothing is lost
   * when a guest signs up. Visits the account already has are kept as they
   * are (the guest copy is dropped instead of breaking the unique rule).
   */
  async function transferProgress(fromKey: string, toKey: string): Promise<void> {
    if (!fromKey || !toKey || fromKey === toKey) return;

    const [guestVisits, accountVisits] = await Promise.all([
      listCompletions(fromKey),
      listCompletions(toKey),
    ]);
    const alreadyVisited = new Set(accountVisits.map((row) => row.destination_id));
    const duplicates = guestVisits.filter((row) => alreadyVisited.has(row.destination_id));
    if (duplicates.length > 0) {
      await client
        .from('destination_completions')
        .delete()
        .in('id', duplicates.map((row) => row.id));
    }

    const [visits, attempts] = await Promise.all([
      client.from('destination_completions').update({ device_id: toKey }).eq('device_id', fromKey),
      client.from('quiz_attempts').update({ device_id: toKey }).eq('device_id', fromKey),
    ]);
    const error = visits.error ?? attempts.error;
    if (error) throw toAppError(error, 'We couldn’t move your guest progress to your account.');
  }

  /** Removes every progress row of one user key (used by the test scripts). */
  async function removeAllFor(userKey: string): Promise<void> {
    const [visits, attempts] = await Promise.all([
      client.from('destination_completions').delete().eq('device_id', userKey),
      client.from('quiz_attempts').delete().eq('device_id', userKey),
    ]);
    const error = visits.error ?? attempts.error;
    if (error) throw toAppError(error, 'We couldn’t clear the progress.');
  }

  return {
    recordAttempt,
    markVisited,
    getCompletion,
    listCompletions,
    listAttempts,
    transferProgress,
    removeAllFor,
  };
}

export type ProgressRepository = ReturnType<typeof createProgressRepository>;
