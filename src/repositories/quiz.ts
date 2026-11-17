/**
 * Quiz repository — reads a destination's questions with their options.
 *
 * A factory that receives the Supabase client, like ./destinations.ts, so
 * scripts/verify-crud.mjs runs the same code in Node. No React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/lib/errors';
import type { Database, QuizQuestionWithOptions } from '@/types/database';

export function createQuizRepository(client: SupabaseClient<Database>) {
  /**
   * The questions in authored order, each with its options. Options come back
   * in no particular order — shuffle them with `prepareQuiz()` before showing.
   */
  async function getForDestination(destinationId: string): Promise<QuizQuestionWithOptions[]> {
    const { data, error } = await client
      .from('quiz_questions')
      .select('id, destination_id, question_text, sort_order, quiz_options(id, option_text, is_correct)')
      .eq('destination_id', destinationId)
      .order('sort_order', { ascending: true });
    if (error) throw toAppError(error, 'We couldn’t load the quiz.');

    return data.map(({ quiz_options: options, ...question }) => ({ ...question, options }));
  }

  return { getForDestination };
}

export type QuizRepository = ReturnType<typeof createQuizRepository>;
