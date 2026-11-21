/**
 * Quiz logic: shuffling, scoring and how a result is presented.
 *
 * Pure functions with no React Native imports, so they are unit-tested in
 * Node (tests/quiz.test.ts) and reused by scripts/verify-crud.mjs.
 */
import type { QuizQuestionWithOptions } from '@/types/database';
import type { TranslationKey } from '@/i18n';

/** A source of numbers in [0, 1). Injected so tests can be deterministic. */
export type RandomSource = () => number;

/** Score from which a result counts as a celebration (4 of 5). */
export const CELEBRATE_RATIO = 0.8;

/** Fisher–Yates shuffle. Returns a new array; the input is left untouched. */
export function shuffle<T>(items: readonly T[], random: RandomSource = Math.random): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

/**
 * Puts questions in their authored order and shuffles each question's options.
 * `quiz_options` has no order column, and the correct answer must never sit
 * in a predictable position, so every attempt gets a fresh arrangement.
 */
export function prepareQuiz(
  questions: readonly QuizQuestionWithOptions[],
  random: RandomSource = Math.random,
): QuizQuestionWithOptions[] {
  return [...questions]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((question) => ({ ...question, options: shuffle(question.options, random) }));
}

/** questionId → the option id the learner picked. */
export type QuizAnswers = Readonly<Record<string, string | undefined>>;

export type QuizScore = {
  score: number;
  total: number;
  /** 0–100, rounded to a whole number. */
  percent: number;
};

/** Whether the picked option is the correct one for that question. */
export function isCorrectAnswer(question: QuizQuestionWithOptions, optionId: string | undefined): boolean {
  if (!optionId) return false;
  return question.options.some((option) => option.id === optionId && option.is_correct);
}

/**
 * Auto-scores a finished quiz: one point per question answered correctly.
 * Unanswered questions score zero; answers to unknown questions are ignored.
 */
export function scoreQuiz(questions: readonly QuizQuestionWithOptions[], answers: QuizAnswers): QuizScore {
  const total = questions.length;
  const score = questions.filter((question) => isCorrectAnswer(question, answers[question.id])).length;
  return { score, total, percent: toPercent(score, total) };
}

export function toPercent(score: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((score / total) * 100);
}

export type ResultTone = 'celebrate' | 'encourage';

/** 4/5 or better is celebrated; anything lower gets an encouraging message. */
export function resultTone({ score, total }: Pick<QuizScore, 'score' | 'total'>): ResultTone {
  return total > 0 && score / total >= CELEBRATE_RATIO ? 'celebrate' : 'encourage';
}

/** Heading and message for the score screen. */
/** i18n keys of the score screen's heading and message for this result. */
export function resultMessage(
  result: Pick<QuizScore, 'score' | 'total'>,
): { title: TranslationKey; message: TranslationKey } {
  if (result.total > 0 && result.score === result.total) {
    return { title: 'quiz.result.perfectTitle', message: 'quiz.result.perfectMessage' };
  }
  if (resultTone(result) === 'celebrate') {
    return { title: 'quiz.result.celebrateTitle', message: 'quiz.result.celebrateMessage' };
  }
  if (result.score === 0) {
    return { title: 'quiz.result.zeroTitle', message: 'quiz.result.zeroMessage' };
  }
  return { title: 'quiz.result.encourageTitle', message: 'quiz.result.encourageMessage' };
}

/** The best of several attempts: highest ratio, then the most recent. */
export function bestAttempt<T extends { score: number; total: number; taken_at?: string | null }>(
  attempts: readonly T[],
): T | null {
  let best: T | null = null;
  for (const attempt of attempts) {
    if (!best) {
      best = attempt;
      continue;
    }
    const ratio = attempt.total > 0 ? attempt.score / attempt.total : 0;
    const bestRatio = best.total > 0 ? best.score / best.total : 0;
    if (ratio > bestRatio || (ratio === bestRatio && (attempt.taken_at ?? '') > (best.taken_at ?? ''))) {
      best = attempt;
    }
  }
  return best;
}
