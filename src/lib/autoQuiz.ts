/**
 * Keeps a user-added destination's starter quiz in step with its record
 * (Run 6). The repository is injected, so the app and scripts/verify-crud.mjs
 * run the same code. No React Native imports.
 *
 *   - create → generate + insert (source = 'auto');
 *   - edit of a quiz field (name, description, municipality, province,
 *     category) → delete that destination's 'auto' rows, insert fresh ones;
 *   - an edit that changes none of them leaves the quiz alone (but gives a
 *     quiz-less entry, e.g. one added before Run 6, its first starter quiz);
 *   - a destination with curated questions is never touched.
 */
import { generateQuiz, quizFieldsChanged } from '@/lib/quizGenerator';
import type { CatalogueEntry, QuizSourceRecord } from '@/lib/quizGenerator';
import type { AutoQuizOutcome, QuizRepository } from '@/repositories/quiz';

export type AutoQuizSync = AutoQuizOutcome | 'unchanged';

export async function syncAutoQuiz(input: {
  quiz: Pick<QuizRepository, 'replaceAutoQuiz' | 'countBySource'>;
  saved: QuizSourceRecord & { id: string };
  /** The record before the edit; omit for a new destination. */
  previous?: QuizSourceRecord | null;
  catalogue: readonly CatalogueEntry[];
}): Promise<AutoQuizSync> {
  const { quiz, saved, previous, catalogue } = input;
  if (previous && !quizFieldsChanged(previous, saved)) {
    // Nothing relevant changed — unless the entry has no quiz at all yet
    // (added before Run 6): then this edit backfills its starter quiz.
    const counts = await quiz.countBySource(saved.id);
    if (counts.curated > 0 || counts.auto > 0) return 'unchanged';
  }
  const questions = generateQuiz(saved, catalogue, saved.id);
  return quiz.replaceAutoQuiz(saved.id, questions);
}
