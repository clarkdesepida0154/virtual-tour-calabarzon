/**
 * Quiz repository — reads a destination's questions with their options, and
 * (Run 6) writes the auto-generated starter quiz of a user-added destination.
 *
 * A factory that receives the Supabase client, like ./destinations.ts, so
 * scripts/verify-crud.mjs runs the same code in Node. No React Native imports.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

import { toAppError } from '@/lib/errors';
import type { GeneratedQuestion } from '@/lib/quizGenerator';
import type { Database, QuizQuestionWithOptions } from '@/types/database';

/** What `replaceAutoQuiz` did. */
export type AutoQuizOutcome = 'written' | 'skipped-curated';

export function createQuizRepository(client: SupabaseClient<Database>) {
  /**
   * The questions in authored order, each with its options. Options come back
   * in no particular order — shuffle them with `prepareQuiz()` before showing.
   */
  async function getForDestination(destinationId: string): Promise<QuizQuestionWithOptions[]> {
    const { data, error } = await client
      .from('quiz_questions')
      .select('id, destination_id, question_text, sort_order, source, quiz_options(id, option_text, is_correct)')
      .eq('destination_id', destinationId)
      .order('sort_order', { ascending: true });
    if (error) throw toAppError(error, 'loadQuiz');

    return data.map(({ quiz_options: options, ...question }) => ({ ...question, options }));
  }

  /** How many questions of each source a destination has. */
  async function countBySource(destinationId: string): Promise<{ curated: number; auto: number }> {
    const { data, error } = await client
      .from('quiz_questions')
      .select('source')
      .eq('destination_id', destinationId);
    if (error) throw toAppError(error, 'loadQuiz');
    return {
      curated: data.filter((row) => row.source === 'curated').length,
      auto: data.filter((row) => row.source === 'auto').length,
    };
  }

  /**
   * Replaces a destination's auto-generated questions with `questions`
   * (source = 'auto'). A destination that has ANY curated question is never
   * touched — curated quizzes always win. Options cascade with their
   * question, so deleting the old 'auto' rows removes their options too.
   */
  async function replaceAutoQuiz(
    destinationId: string,
    questions: readonly GeneratedQuestion[],
  ): Promise<AutoQuizOutcome> {
    const counts = await countBySource(destinationId);
    if (counts.curated > 0) return 'skipped-curated';

    const removed = await client
      .from('quiz_questions')
      .delete()
      .eq('destination_id', destinationId)
      .eq('source', 'auto');
    if (removed.error) throw toAppError(removed.error, 'saveAutoQuiz');
    if (questions.length === 0) return 'written';

    const inserted = await client
      .from('quiz_questions')
      .insert(
        questions.map((question) => ({
          destination_id: destinationId,
          question_text: question.question_text,
          sort_order: question.sort_order,
          source: 'auto' as const,
        })),
      )
      .select('id, sort_order');
    if (inserted.error) throw toAppError(inserted.error, 'saveAutoQuiz');

    const idBySort = new Map(inserted.data.map((row) => [row.sort_order, row.id]));
    const options = questions.flatMap((question) => {
      const questionId = idBySort.get(question.sort_order);
      if (!questionId) return [];
      return question.options.map((option) => ({
        question_id: questionId,
        option_text: option.option_text,
        is_correct: option.is_correct,
      }));
    });
    const optionsResult = await client.from('quiz_options').insert(options);
    if (optionsResult.error) {
      // Never leave questions without options behind.
      await client.from('quiz_questions').delete().eq('destination_id', destinationId).eq('source', 'auto');
      throw toAppError(optionsResult.error, 'saveAutoQuiz');
    }
    return 'written';
  }

  return { getForDestination, countBySource, replaceAutoQuiz };
}

export type QuizRepository = ReturnType<typeof createQuizRepository>;
