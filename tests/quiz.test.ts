/// <reference types="node" />
/**
 * Unit tests for the quiz engine and the other pure modules behind Phase 2.
 *
 *   npm test
 *
 * Runs with Node's built-in test runner through tsx (no extra dependencies).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { friendlyAuthMessage, validateSignIn, validateSignUp, hasErrors } from '../src/lib/authForm';
import { splitLead } from '../src/lib/format';
import { CALABARZON_REGION, hasCoordinates, regionForCoordinates } from '../src/lib/mapRegion';
import { bestScoresByDestination, summarizeProgress } from '../src/lib/progress';
import {
  bestAttempt,
  isCorrectAnswer,
  prepareQuiz,
  resultMessage,
  resultTone,
  scoreQuiz,
  shuffle,
  toPercent,
} from '../src/lib/quiz';
import type { DestinationSummary, QuizQuestionWithOptions } from '../src/types/database';

/** Deterministic pseudo-random numbers (mulberry32). */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function question(id: string, sortOrder: number, correct = 'b'): QuizQuestionWithOptions {
  return {
    id,
    destination_id: 'd1',
    question_text: `Question ${id}?`,
    sort_order: sortOrder,
    options: ['a', 'b', 'c', 'd'].map((letter) => ({
      id: `${id}-${letter}`,
      option_text: `Option ${letter}`,
      is_correct: letter === correct,
    })),
  };
}

const QUIZ = [question('q1', 1), question('q2', 2), question('q3', 3), question('q4', 4), question('q5', 5)];

describe('scoreQuiz', () => {
  it('scores a perfect quiz 5/5 = 100%', () => {
    const answers = Object.fromEntries(QUIZ.map((q) => [q.id, `${q.id}-b`]));
    assert.deepEqual(scoreQuiz(QUIZ, answers), { score: 5, total: 5, percent: 100 });
  });

  it('scores all wrong as 0/5 = 0%', () => {
    const answers = Object.fromEntries(QUIZ.map((q) => [q.id, `${q.id}-a`]));
    assert.deepEqual(scoreQuiz(QUIZ, answers), { score: 0, total: 5, percent: 0 });
  });

  it('counts only correct answers (3/5 = 60%)', () => {
    const answers = { q1: 'q1-b', q2: 'q2-b', q3: 'q3-b', q4: 'q4-c', q5: 'q5-d' };
    assert.deepEqual(scoreQuiz(QUIZ, answers), { score: 3, total: 5, percent: 60 });
  });

  it('treats unanswered questions as wrong, and keeps the full total', () => {
    assert.deepEqual(scoreQuiz(QUIZ, { q1: 'q1-b' }), { score: 1, total: 5, percent: 20 });
  });

  it('ignores answers that belong to another question', () => {
    // q1's correct option id given as the answer to q2 must not count.
    assert.equal(scoreQuiz(QUIZ, { q2: 'q1-b' }).score, 0);
  });

  it('ignores answers to questions that are not in the quiz', () => {
    assert.equal(scoreQuiz(QUIZ, { unknown: 'q1-b' }).score, 0);
  });

  it('handles an empty quiz without dividing by zero', () => {
    assert.deepEqual(scoreQuiz([], {}), { score: 0, total: 0, percent: 0 });
  });

  it('is not fooled by the option order (scores the same after shuffling)', () => {
    const answers = { q1: 'q1-b', q2: 'q2-a', q3: 'q3-b', q4: 'q4-b', q5: 'q5-c' };
    const shuffled = prepareQuiz(QUIZ, seeded(7));
    assert.deepEqual(scoreQuiz(shuffled, answers), scoreQuiz(QUIZ, answers));
  });
});

describe('isCorrectAnswer / toPercent', () => {
  it('recognises the correct option only', () => {
    assert.equal(isCorrectAnswer(QUIZ[0], 'q1-b'), true);
    assert.equal(isCorrectAnswer(QUIZ[0], 'q1-a'), false);
    assert.equal(isCorrectAnswer(QUIZ[0], undefined), false);
  });

  it('rounds percentages to whole numbers', () => {
    assert.equal(toPercent(1, 3), 33);
    assert.equal(toPercent(2, 3), 67);
    assert.equal(toPercent(4, 5), 80);
    assert.equal(toPercent(0, 0), 0);
  });
});

describe('shuffle / prepareQuiz', () => {
  it('keeps every item exactly once and does not mutate the input', () => {
    const input = [1, 2, 3, 4, 5, 6];
    const output = shuffle(input, seeded(42));
    assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
    assert.deepEqual([...output].sort(), [1, 2, 3, 4, 5, 6]);
  });

  it('puts questions in authored order regardless of load order', () => {
    const prepared = prepareQuiz([QUIZ[3], QUIZ[0], QUIZ[4], QUIZ[1], QUIZ[2]], seeded(1));
    assert.deepEqual(prepared.map((q) => q.sort_order), [1, 2, 3, 4, 5]);
  });

  it('never leaves the correct answer in a fixed position', () => {
    // Over many attempts, the correct option should land in all 4 slots.
    const positions = new Set<number>();
    const random = seeded(2026);
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const [first] = prepareQuiz([QUIZ[0]], random);
      positions.add(first.options.findIndex((option) => option.is_correct));
    }
    assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
  });

  it('spreads the correct answer roughly evenly across positions', () => {
    const counts = [0, 0, 0, 0];
    const random = seeded(99);
    for (let attempt = 0; attempt < 4000; attempt += 1) {
      const [first] = prepareQuiz([QUIZ[0]], random);
      counts[first.options.findIndex((option) => option.is_correct)] += 1;
    }
    for (const count of counts) assert.ok(count > 800 && count < 1200, `uneven: ${counts.join(', ')}`);
  });
});

describe('result presentation', () => {
  it('celebrates 4/5 and 5/5, encourages below that', () => {
    assert.equal(resultTone({ score: 5, total: 5 }), 'celebrate');
    assert.equal(resultTone({ score: 4, total: 5 }), 'celebrate');
    assert.equal(resultTone({ score: 3, total: 5 }), 'encourage');
    assert.equal(resultTone({ score: 0, total: 5 }), 'encourage');
    assert.equal(resultTone({ score: 0, total: 0 }), 'encourage');
  });

  it('has a distinct message for a perfect score and for zero', () => {
    assert.match(resultMessage({ score: 5, total: 5 }).title, /perfect/i);
    assert.notEqual(resultMessage({ score: 0, total: 5 }).title, resultMessage({ score: 2, total: 5 }).title);
  });
});

describe('best scores', () => {
  const attempts = [
    { destination_id: 'a', score: 3, total: 5, taken_at: '2026-11-01T00:00:00Z' },
    { destination_id: 'a', score: 5, total: 5, taken_at: '2026-11-02T00:00:00Z' },
    { destination_id: 'a', score: 4, total: 5, taken_at: '2026-11-03T00:00:00Z' },
    { destination_id: 'b', score: 2, total: 5, taken_at: '2026-11-04T00:00:00Z' },
  ];

  it('keeps the best attempt, not the latest', () => {
    assert.equal(bestAttempt(attempts.slice(0, 3))?.score, 5);
    assert.equal(bestAttempt([]), null);
  });

  it('finds the best score per destination', () => {
    const best = bestScoresByDestination(attempts);
    assert.deepEqual(best.get('a'), { score: 5, total: 5, percent: 100 });
    assert.deepEqual(best.get('b'), { score: 2, total: 5, percent: 40 });
  });
});

describe('summarizeProgress', () => {
  const destinations: DestinationSummary[] = [
    { id: 'a', name: 'Alpha', municipality: 'X', province: 'Cavite', category: 'Historical Site', cover_image_url: null, latitude: null, longitude: null },
    { id: 'b', name: 'Beta', municipality: 'Y', province: 'Cavite', category: 'Natural Wonder', cover_image_url: null, latitude: null, longitude: null },
    { id: 'c', name: 'Gamma', municipality: 'Z', province: 'Quezon', category: 'Museum & Art', cover_image_url: null, latitude: null, longitude: null },
  ];

  it('is empty before any activity', () => {
    const summary = summarizeProgress(destinations, [], []);
    assert.equal(summary.visitedCount, 0);
    assert.equal(summary.quizzesTaken, 0);
    assert.equal(summary.averagePercent, null);
    assert.equal(summary.best, null);
    assert.equal(summary.journey.length, 0);
    assert.equal(summary.provinces.length, 5);
  });

  it('counts visits, attempts, averages and provinces; ignores deleted destinations', () => {
    const summary = summarizeProgress(
      destinations,
      [
        { destination_id: 'a', completed_at: '2026-11-01T00:00:00Z' },
        { destination_id: 'gone', completed_at: '2026-11-01T00:00:00Z' },
      ],
      [
        { destination_id: 'a', score: 4, total: 5, taken_at: '2026-11-02T00:00:00Z' },
        { destination_id: 'c', score: 2, total: 5, taken_at: '2026-11-03T00:00:00Z' },
        { destination_id: 'gone', score: 5, total: 5, taken_at: '2026-11-03T00:00:00Z' },
      ],
    );
    assert.equal(summary.visitedCount, 1);
    assert.equal(summary.quizzesTaken, 2);
    assert.equal(summary.averagePercent, 60);
    assert.deepEqual(summary.best, { score: 4, total: 5, percent: 80 });
    assert.deepEqual(
      summary.provinces.find((row) => row.province === 'Cavite'),
      { province: 'Cavite', total: 2, visited: 1 },
    );
    // Most recent activity first: Gamma (quiz on the 3rd), then Alpha.
    assert.deepEqual(summary.journey.map((row) => row.destination.id), ['c', 'a']);
  });
});

describe('auth form validation', () => {
  it('requires a plausible email and a password to sign in', () => {
    assert.ok(hasErrors(validateSignIn({ email: '', password: '' })));
    assert.ok(validateSignIn({ email: 'not-an-email', password: 'x' }).email);
    assert.equal(hasErrors(validateSignIn({ email: 'a@b.ph', password: 'x' })), false);
  });

  it('checks password length and confirmation on sign-up', () => {
    assert.ok(validateSignUp({ email: 'a@b.ph', password: 'short', confirmPassword: 'short' }).password);
    assert.ok(validateSignUp({ email: 'a@b.ph', password: 'longenough', confirmPassword: 'different' }).confirmPassword);
    assert.equal(hasErrors(validateSignUp({ email: 'a@b.ph', password: 'longenough', confirmPassword: 'longenough' })), false);
  });

  it('turns Supabase auth errors into plain language', () => {
    assert.match(friendlyAuthMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'x'), /don’t match/);
    assert.match(friendlyAuthMessage({ message: 'Email not confirmed' }, 'x'), /confirm your email/);
    assert.match(friendlyAuthMessage({ code: 'over_email_send_rate_limit', message: '' }, 'x'), /wait/);
    assert.equal(friendlyAuthMessage({ message: 'something odd' }, 'fallback'), 'fallback');
  });
});

describe('text and map helpers', () => {
  it('splits the opening sentence, skipping abbreviations like "St."', () => {
    const { lead, rest } = splitLead('The church of St. Martin was rebuilt in 1856. It is large. More text.');
    assert.equal(lead, 'The church of St. Martin was rebuilt in 1856.');
    assert.equal(rest, 'It is large. More text.');
    assert.equal(splitLead('One sentence only').lead, null);
  });

  it('frames every coordinate, and falls back to the whole region', () => {
    const points = [
      { latitude: 14.38, longitude: 120.57 },
      { latitude: 13.76, longitude: 121.55 },
    ];
    const region = regionForCoordinates(points);
    for (const point of points) {
      assert.ok(Math.abs(point.latitude - region.latitude) <= region.latitudeDelta / 2);
      assert.ok(Math.abs(point.longitude - region.longitude) <= region.longitudeDelta / 2);
    }
    assert.deepEqual(regionForCoordinates([]), CALABARZON_REGION);
    assert.equal(hasCoordinates({ latitude: null, longitude: 121 }), false);
    assert.equal(hasCoordinates({ latitude: 14.1, longitude: 121 }), true);
  });
});
