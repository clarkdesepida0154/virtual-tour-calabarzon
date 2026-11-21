/// <reference types="node" />
/**
 * Unit tests for the Run 6 feature modules: the 360° link, the starter-quiz
 * generator and its sync rules, badges, ratings maths, insights,
 * certificates, the field-trip planner and saved plans.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CATEGORIES, PROVINCES } from '../src/constants/taxonomy';
import type { Category, Province } from '../src/constants/taxonomy';
import { BADGES, BADGE_THRESHOLDS, earnedCount, evaluateBadges, newlyEarned, parseSeenBadges } from '../src/lib/achievements';
import type { AchievementInput, BadgeId } from '../src/lib/achievements';
import { syncAutoQuiz } from '../src/lib/autoQuiz';
import { holderName, parseScope, qualifyingCertificates } from '../src/lib/certificate';
import { distanceKm } from '../src/lib/geo';
import { barShare, computeInsights } from '../src/lib/insights';
import { streetViewUrl } from '../src/lib/outbound';
import {
  MAX_STOPS,
  buildDirectionsUrl,
  estimateDriveMinutes,
  legsFor,
  moveItem,
  orderNearestNeighbor,
  splitMinutes,
  toggleSelection,
  totalKm,
} from '../src/lib/planner';
import type { Stop } from '../src/lib/planner';
import { prepareQuiz } from '../src/lib/quiz';
import {
  AUTO_QUIZ_SIZE,
  firstSentence,
  generateQuiz,
  hashSeed,
  maskName,
  quizFieldsChanged,
  seededRandom,
} from '../src/lib/quizGenerator';
import type { CatalogueEntry, GeneratedQuestion, QuizSourceRecord } from '../src/lib/quizGenerator';
import { clampStars, formatAverage, roundToTenth, summarizeRatings, summarizeStars } from '../src/lib/ratings';
import { createPlanStore, parsePlans, TRIP_PLANS_KEY } from '../src/lib/tripPlans';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATALOGUE: CatalogueEntry[] = [
  { id: 'a', name: 'Aguinaldo Shrine', municipality: 'Kawit', province: 'Cavite', category: 'Historical Site' },
  { id: 'b', name: 'Rizal Shrine', municipality: 'Calamba', province: 'Laguna', category: 'Historical Site' },
  { id: 'c', name: 'Pagsanjan Falls', municipality: 'Cavinti', province: 'Laguna', category: 'Natural Wonder' },
  { id: 'd', name: 'Taal Basilica', municipality: 'Taal', province: 'Batangas', category: 'Church & Religious' },
  { id: 'e', name: 'Pinto Art Museum', municipality: 'Antipolo', province: 'Rizal', category: 'Museum & Art' },
  { id: 'f', name: 'Lucban Heritage Town', municipality: 'Lucban', province: 'Quezon', category: 'Heritage Town & Culture' },
];

const RICH: QuizSourceRecord & { id: string } = {
  id: 'new-1',
  name: 'Casa Hacienda de Tejeros',
  description:
    'Casa Hacienda de Tejeros is a restored estate house where revolutionary leaders gathered in 1897. The convention held here elected new officers and changed the course of the uprising against Spanish colonial authorities in the province.',
  municipality: 'Rosario',
  province: 'Cavite',
  category: 'Historical Site',
};

const SPARSE: QuizSourceRecord & { id: string } = {
  id: 'new-2',
  name: 'Little Chapel',
  description: 'A small chapel.',
  municipality: null,
  province: 'Quezon',
  category: 'Church & Religious',
};

function correctOf(question: GeneratedQuestion) {
  return question.options.filter((option) => option.is_correct);
}

function assertSound(questions: GeneratedQuestion[], record: QuizSourceRecord) {
  assert.equal(questions.length, AUTO_QUIZ_SIZE, 'always five questions');
  const userData = [record.name, record.province, record.category, record.municipality ?? '', record.description]
    .join(' ')
    .toLowerCase();
  questions.forEach((question, index) => {
    assert.equal(question.sort_order, index + 1, 'sort orders 1..5');
    assert.equal(correctOf(question).length, 1, `exactly one correct option in "${question.question_text}"`);
    assert.ok(question.options.length >= 2, 'at least one distractor');
    assert.ok(question.options.length <= 5, 'at most five options');
    const texts = question.options.map((option) => option.option_text.toLowerCase());
    assert.equal(new Set(texts).size, texts.length, 'options are distinct');
    assert.ok(texts.every((text) => text.length > 0), 'no empty option');
    const answer = correctOf(question)[0].option_text;
    // The answer always comes from the user's own entry (region derives from the province).
    if (question.kind === 'statement') {
      assert.equal(answer, `It is a ${record.category} in ${record.province}.`);
    } else if (question.kind === 'region') {
      assert.equal(answer, 'Region IV-A (CALABARZON)');
    } else if (question.kind === 'trueFalse') {
      const claimed = question.question_text.match(/ is in (\w+)\.$/)![1];
      assert.equal(answer, claimed === record.province ? 'True' : 'False');
    } else {
      assert.ok(userData.includes(answer.toLowerCase()), `answer "${answer}" is in the user's data`);
    }
  });
  const kinds = questions.map((question) => question.kind);
  assert.equal(new Set(kinds).size, kinds.length, 'no question kind twice');
}

// ---------------------------------------------------------------------------
// 360° view
// ---------------------------------------------------------------------------

describe('Street View link', () => {
  it('builds the no-key pano URL with 6-decimal coordinates', () => {
    assert.equal(
      streetViewUrl({ latitude: 14.43291234567, longitude: 120.8855 }),
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=14.432912,120.8855',
    );
  });
  it('returns null without coordinates', () => {
    assert.equal(streetViewUrl({ latitude: null, longitude: 121 }), null);
    assert.equal(streetViewUrl({ latitude: 200, longitude: 121 }), null);
  });
});

// ---------------------------------------------------------------------------
// Starter-quiz generator
// ---------------------------------------------------------------------------

describe('quiz generator', () => {
  it('builds five sound questions from a rich entry: province, town, category, identify, cloze', () => {
    const questions = generateQuiz(RICH, CATALOGUE);
    assertSound(questions, RICH);
    assert.deepEqual(
      questions.map((question) => question.kind),
      ['province', 'municipality', 'category', 'identify', 'cloze'],
    );
  });

  it('province question offers all five provinces (the other four as distractors)', () => {
    const [province] = generateQuiz(RICH, CATALOGUE);
    assert.deepEqual(province.options.map((option) => option.option_text).sort(), [...PROVINCES].sort());
  });

  it('municipality distractors are other catalogue towns, never the right one', () => {
    const town = generateQuiz(RICH, CATALOGUE)[1];
    const distractors = town.options.filter((option) => !option.is_correct).map((option) => option.option_text);
    assert.equal(distractors.length, 3);
    const catalogueTowns = CATALOGUE.map((entry) => entry.municipality);
    assert.ok(distractors.every((text) => catalogueTowns.includes(text) && text !== 'Rosario'));
  });

  it('category distractors are three other categories', () => {
    const category = generateQuiz(RICH, CATALOGUE)[2];
    const texts = category.options.map((option) => option.option_text);
    assert.equal(texts.length, 4);
    assert.ok(texts.every((text) => (CATEGORIES as readonly string[]).includes(text)));
  });

  it('the identify question masks the name and offers other catalogue names', () => {
    const identify = generateQuiz(RICH, CATALOGUE)[3];
    assert.ok(!identify.question_text.includes('Casa Hacienda de Tejeros'), 'name is masked');
    assert.ok(identify.question_text.includes('this place'));
    const distractors = identify.options.filter((option) => !option.is_correct).map((option) => option.option_text);
    assert.ok(distractors.every((name) => CATALOGUE.some((entry) => entry.name === name)));
  });

  it('the cloze answer sits exactly where the blank is in the user’s description', () => {
    const cloze = generateQuiz(RICH, CATALOGUE)[4];
    const answer = correctOf(cloze)[0].option_text;
    const excerpt = cloze.question_text.match(/“(.*)”/)![1].replace(/^…|…$/g, '');
    const restored = excerpt.replace('_____', answer);
    assert.ok(RICH.description.includes(restored), 'filling the blank restores the original text');
  });

  it('falls back to clean templates for a sparse entry (no town, one-line description)', () => {
    const questions = generateQuiz(SPARSE, CATALOGUE);
    assertSound(questions, SPARSE);
    assert.equal(questions[0].kind, 'province');
    assert.equal(questions[2].kind, 'category');
    assert.ok(!questions.some((question) => question.kind === 'municipality'), 'no town question without a town');
    assert.ok(!questions.some((question) => question.kind === 'cloze'), 'no cloze without a rich description');
  });

  it('still makes five questions with no catalogue at all', () => {
    assertSound(generateQuiz(SPARSE, []), SPARSE);
    assertSound(generateQuiz(RICH, []), RICH);
  });

  it('never uses the destination itself as a distractor (even when it is in the catalogue)', () => {
    const withSelf = [...CATALOGUE, { ...RICH }];
    for (const question of generateQuiz(RICH, withSelf)) {
      const wrong = question.options.filter((option) => !option.is_correct).map((option) => option.option_text);
      assert.ok(!wrong.includes(RICH.name));
      assert.ok(!wrong.includes('Rosario'));
    }
  });

  it('is deterministic for the same seed, and varies with the seed', () => {
    const one = JSON.stringify(generateQuiz(RICH, CATALOGUE, 'seed-1'));
    assert.equal(JSON.stringify(generateQuiz(RICH, CATALOGUE, 'seed-1')), one);
    const others = ['seed-2', 'seed-3', 'seed-4'].map((seed) => JSON.stringify(generateQuiz(RICH, CATALOGUE, seed)));
    assert.ok(others.some((other) => other !== one), 'a different seed changes something');
  });

  it('works with the quiz engine: prepareQuiz keeps exactly one correct option per question', () => {
    const questions = generateQuiz(RICH, CATALOGUE).map((question, index) => ({
      id: `q${index}`,
      destination_id: RICH.id,
      question_text: question.question_text,
      sort_order: question.sort_order,
      source: 'auto' as const,
      options: question.options.map((option, optionIndex) => ({ id: `o${index}-${optionIndex}`, ...option })),
    }));
    for (const question of prepareQuiz(questions)) {
      assert.equal(question.options.filter((option) => option.is_correct).length, 1);
    }
  });

  it('seeded random is stable and in [0, 1)', () => {
    const a = seededRandom(hashSeed('x'));
    const b = seededRandom(hashSeed('x'));
    for (let i = 0; i < 50; i += 1) {
      const value = a();
      assert.equal(value, b());
      assert.ok(value >= 0 && value < 1);
    }
  });

  it('text helpers: first sentence and name masking', () => {
    assert.equal(firstSentence('One two. Three four.'), 'One two.');
    assert.equal(firstSentence('No full stop here'), 'No full stop here');
    assert.equal(maskName('Visit Taal Basilica today; taal basilica is old.', 'Taal Basilica'), 'Visit this place today; this place is old.');
  });

  it('quizFieldsChanged: only name, description, town, province and category matter', () => {
    assert.equal(quizFieldsChanged(RICH, { ...RICH }), false);
    assert.equal(quizFieldsChanged(RICH, { ...RICH, name: 'Other' }), true);
    assert.equal(quizFieldsChanged(RICH, { ...RICH, municipality: 'Imus' }), true);
    assert.equal(quizFieldsChanged(RICH, { ...RICH, province: 'Laguna' as Province }), true);
    assert.equal(quizFieldsChanged(RICH, { ...RICH, category: 'Museum & Art' as Category }), true);
    assert.equal(quizFieldsChanged(RICH, { ...RICH, description: `${RICH.description} More.` }), true);
    assert.equal(quizFieldsChanged(RICH, { ...RICH, description: `  ${RICH.description}  ` }), false, 'whitespace only');
  });
});

describe('starter-quiz sync (create / edit / curated)', () => {
  function fakeRepo(counts = { curated: 0, auto: 0 }) {
    const calls: { id: string; count: number }[] = [];
    return {
      calls,
      repo: {
        countBySource: async () => counts,
        replaceAutoQuiz: async (id: string, questions: readonly GeneratedQuestion[]) => {
          if (counts.curated > 0) return 'skipped-curated' as const;
          calls.push({ id, count: questions.length });
          return 'written' as const;
        },
      },
    };
  }

  it('create → five questions written', async () => {
    const { repo, calls } = fakeRepo();
    assert.equal(await syncAutoQuiz({ quiz: repo, saved: RICH, catalogue: CATALOGUE }), 'written');
    assert.deepEqual(calls, [{ id: RICH.id, count: 5 }]);
  });

  it('edit of a quiz field → regenerated', async () => {
    const { repo, calls } = fakeRepo({ curated: 0, auto: 5 });
    const result = await syncAutoQuiz({ quiz: repo, saved: { ...RICH, name: 'Tejeros Convention Site' }, previous: RICH, catalogue: CATALOGUE });
    assert.equal(result, 'written');
    assert.equal(calls.length, 1);
  });

  it('edit of other fields (address, photo) → left alone when a quiz exists', async () => {
    const { repo, calls } = fakeRepo({ curated: 0, auto: 5 });
    assert.equal(await syncAutoQuiz({ quiz: repo, saved: RICH, previous: { ...RICH }, catalogue: CATALOGUE }), 'unchanged');
    assert.equal(calls.length, 0);
  });

  it('edit of a quiz-less entry backfills its starter quiz', async () => {
    const { repo, calls } = fakeRepo({ curated: 0, auto: 0 });
    assert.equal(await syncAutoQuiz({ quiz: repo, saved: RICH, previous: { ...RICH }, catalogue: CATALOGUE }), 'written');
    assert.equal(calls.length, 1);
  });

  it('a destination with curated questions is never touched', async () => {
    const { repo, calls } = fakeRepo({ curated: 5, auto: 0 });
    const result = await syncAutoQuiz({ quiz: repo, saved: { ...RICH, name: 'Renamed' }, previous: RICH, catalogue: CATALOGUE });
    assert.equal(result, 'skipped-curated');
    assert.equal(calls.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

/** 26 destinations: 5 Cavite, 6 Laguna, 5 Batangas, 5 Rizal, 5 Quezon. */
const PER_PROVINCE: Record<Province, number> = { Cavite: 5, Laguna: 6, Batangas: 5, Rizal: 5, Quezon: 5 };
const DESTINATIONS = PROVINCES.flatMap((province) =>
  Array.from({ length: PER_PROVINCE[province] }, (_, index) => ({ id: `${province}-${index}`, province })),
);
const day = (n: number) => `2026-11-${String(n).padStart(2, '0')}T10:00:00.000Z`;
const empty: AchievementInput = { destinations: DESTINATIONS, completions: [], attempts: [], favorites: [] };
const statusOf = (input: AchievementInput, id: BadgeId) => evaluateBadges(input).find((entry) => entry.badge.id === id)!;

describe('badges', () => {
  it('the registry has the 10 badges in order', () => {
    assert.deepEqual(BADGES.map((badge) => badge.id), [
      'first-journey',
      'explorer-cavite',
      'explorer-laguna',
      'explorer-batangas',
      'explorer-rizal',
      'explorer-quezon',
      'heritage-scholar',
      'quiz-enthusiast',
      'collector',
      'calabarzon-master',
    ]);
  });

  it('nothing is earned on a fresh start, with progress at 0', () => {
    const statuses = evaluateBadges(empty);
    assert.equal(earnedCount(statuses), 0);
    assert.ok(statuses.every((entry) => entry.current === 0 && entry.earnedAt === null));
    assert.equal(statusOf(empty, 'explorer-laguna').target, 6);
    assert.equal(statusOf(empty, 'calabarzon-master').target, 26);
  });

  it('First Journey: one visit, dated by that visit', () => {
    const input = { ...empty, completions: [{ destination_id: 'Rizal-0', completed_at: day(3) }] };
    const first = statusOf(input, 'first-journey');
    assert.equal(first.earned, true);
    assert.equal(first.earnedAt, day(3));
  });

  it('a province explorer needs every site of that province; dated by the last one', () => {
    const cavite = DESTINATIONS.filter((d) => d.province === 'Cavite');
    const four = cavite.slice(0, 4).map((d, i) => ({ destination_id: d.id, completed_at: day(i + 1) }));
    const partial = statusOf({ ...empty, completions: four }, 'explorer-cavite');
    assert.equal(partial.earned, false);
    assert.equal(partial.current, 4);
    const all = [...four, { destination_id: cavite[4].id, completed_at: day(9) }];
    const done = statusOf({ ...empty, completions: all }, 'explorer-cavite');
    assert.equal(done.earned, true);
    assert.equal(done.earnedAt, day(9));
    assert.equal(statusOf({ ...empty, completions: all }, 'explorer-laguna').earned, false);
  });

  for (const province of PROVINCES) {
    it(`Explorer of ${province}: earned with all ${PER_PROVINCE[province]} sites`, () => {
      const completions = DESTINATIONS.filter((d) => d.province === province).map((d, i) => ({ destination_id: d.id, completed_at: day(i + 1) }));
      assert.equal(statusOf({ ...empty, completions }, `explorer-${province.toLowerCase()}` as BadgeId).earned, true);
    });
  }

  it('Heritage Scholar: 5 perfect quizzes on 5 different places (retakes of one place count once)', () => {
    const perfect = (id: string, n: number) => ({ destination_id: id, score: 5, total: 5, taken_at: day(n) });
    const sameFive = Array.from({ length: 6 }, (_, i) => perfect('Cavite-0', i + 1));
    assert.equal(statusOf({ ...empty, attempts: sameFive }, 'heritage-scholar').earned, false);
    const five = ['Cavite-0', 'Cavite-1', 'Laguna-0', 'Rizal-0', 'Quezon-0'].map((id, i) => perfect(id, i + 1));
    const withNearMiss = [...five.slice(0, 4), { destination_id: 'Batangas-0', score: 4, total: 5, taken_at: day(7) }];
    assert.equal(statusOf({ ...empty, attempts: withNearMiss }, 'heritage-scholar').earned, false);
    const scholar = statusOf({ ...empty, attempts: five }, 'heritage-scholar');
    assert.equal(scholar.earned, true);
    assert.equal(scholar.earnedAt, day(5));
  });

  it(`Quiz Enthusiast: ${BADGE_THRESHOLDS.attempts} attempts, dated by the 15th`, () => {
    const attempts = Array.from({ length: 15 }, (_, i) => ({ destination_id: 'Laguna-1', score: 1, total: 5, taken_at: day(i + 1) }));
    assert.equal(statusOf({ ...empty, attempts: attempts.slice(0, 14) }, 'quiz-enthusiast').earned, false);
    const done = statusOf({ ...empty, attempts }, 'quiz-enthusiast');
    assert.equal(done.earned, true);
    assert.equal(done.earnedAt, day(15));
  });

  it(`Collector: ${BADGE_THRESHOLDS.favorites} favorites, dated by the 8th`, () => {
    const favorites = DESTINATIONS.slice(0, 8).map((d, i) => ({ destination_id: d.id, created_at: day(20 - i) }));
    const collector = statusOf({ ...empty, favorites }, 'collector');
    assert.equal(collector.earned, true);
    assert.equal(collector.earnedAt, day(20));
    assert.equal(statusOf({ ...empty, favorites: favorites.slice(1) }, 'collector').current, 7);
  });

  it('CALABARZON Master: all 26 visited, and it implies every province badge', () => {
    const completions = DESTINATIONS.map((d, i) => ({ destination_id: d.id, completed_at: `2026-10-01T00:00:${String(i).padStart(2, '0')}.000Z` }));
    const statuses = evaluateBadges({ ...empty, completions });
    assert.equal(statuses.find((entry) => entry.badge.id === 'calabarzon-master')!.earned, true);
    assert.equal(earnedCount(statuses), 7, 'first journey + 5 provinces + master');
    const almost = evaluateBadges({ ...empty, completions: completions.slice(1) });
    assert.equal(almost.find((entry) => entry.badge.id === 'calabarzon-master')!.current, 25);
  });

  it('rows for deleted destinations are ignored', () => {
    const input = { ...empty, completions: [{ destination_id: 'gone', completed_at: day(1) }], favorites: Array.from({ length: 8 }, (_, i) => ({ destination_id: `gone-${i}`, created_at: day(i + 1) })) };
    assert.equal(statusOf(input, 'first-journey').earned, false);
    assert.equal(statusOf(input, 'collector').earned, false);
  });

  it('newlyEarned uses the seen list so a celebration fires once', () => {
    const input = { ...empty, completions: [{ destination_id: 'Rizal-0', completed_at: day(3) }] };
    const statuses = evaluateBadges(input);
    assert.deepEqual(newlyEarned(statuses, new Set()).map((entry) => entry.badge.id), ['first-journey']);
    assert.deepEqual(newlyEarned(statuses, new Set(['first-journey'])), []);
  });

  it('parseSeenBadges tolerates junk', () => {
    assert.deepEqual([...parseSeenBadges('["first-journey", 3]')], ['first-journey']);
    assert.equal(parseSeenBadges('nope').size, 0);
    assert.equal(parseSeenBadges(null).size, 0);
    assert.equal(parseSeenBadges('{"a":1}').size, 0);
  });
});

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------

describe('ratings maths', () => {
  it('average to one decimal + count', () => {
    assert.deepEqual(summarizeStars([5, 4, 5, 5, 4]), { average: 4.6, count: 5 });
    assert.deepEqual(summarizeStars([3]), { average: 3, count: 1 });
    assert.equal(summarizeStars([]), null);
  });
  it('rounds halves up despite float error', () => {
    assert.equal(roundToTenth(4.65), 4.7);
    assert.equal(roundToTenth(4.25), 4.3);
    assert.equal(formatAverage(4), '4.0');
  });
  it('groups by destination and ignores invalid stars', () => {
    const summary = summarizeRatings([
      { destination_id: 'a', stars: 5 },
      { destination_id: 'a', stars: 4 },
      { destination_id: 'b', stars: 2 },
      { destination_id: 'b', stars: 9 },
    ]);
    assert.deepEqual(summary, { a: { average: 4.5, count: 2 }, b: { average: 2, count: 1 } });
  });
  it('clampStars keeps 1..5 whole numbers', () => {
    assert.deepEqual([0, 1, 2.4, 2.6, 7, Number.NaN].map(clampStars), [1, 1, 2, 3, 5, 1]);
  });
});

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

describe('heritage insights', () => {
  const places = CATALOGUE.map((entry) => ({ ...entry, id: entry.id! }));
  it('empty database → empty state, zeroed groups', () => {
    const insights = computeInsights({ destinations: places, completions: [], attempts: [], ratings: [] });
    assert.equal(insights.isEmpty, true);
    assert.equal(insights.mostVisited.length, 0);
    assert.equal(insights.visitsByProvince.length, 5);
    assert.ok(insights.visitsByProvince.every((row) => row.visits === 0));
  });

  it('ranks most visited, top rated (min 1 rating), toughest quizzes (lowest average first)', () => {
    const insights = computeInsights({
      destinations: places,
      completions: [{ destination_id: 'b' }, { destination_id: 'b' }, { destination_id: 'a' }, { destination_id: 'gone' }],
      attempts: [
        { destination_id: 'a', score: 5, total: 5 },
        { destination_id: 'c', score: 1, total: 5 },
        { destination_id: 'c', score: 2, total: 5 },
        { destination_id: 'd', score: 0, total: 0 },
      ],
      ratings: [
        { destination_id: 'e', stars: 5 },
        { destination_id: 'a', stars: 4 },
        { destination_id: 'a', stars: 5 },
      ],
    });
    assert.equal(insights.isEmpty, false);
    assert.deepEqual(insights.mostVisited.map((row) => [row.destination.id, row.value]), [['b', 2], ['a', 1]]);
    assert.deepEqual(insights.topRated.map((row) => [row.destination.id, row.value, row.count]), [['e', 5, 1], ['a', 4.5, 2]]);
    assert.deepEqual(insights.toughestQuizzes.map((row) => [row.destination.id, row.value]), [['c', 30], ['a', 100]]);
    assert.equal(insights.totals.visits, 3, 'rows of deleted places ignored');
    assert.equal(insights.visitsByProvince.find((row) => row.province === 'Laguna')!.visits, 2);
    assert.equal(insights.visitsByCategory.find((row) => row.category === 'Historical Site')!.visits, 3);
  });

  it('caps each ranking at 5', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ id: `x${i}`, name: `Place ${i}`, province: 'Rizal' as Province, category: 'Museum & Art' as Category }));
    const insights = computeInsights({ destinations: many, completions: many.map((p) => ({ destination_id: p.id })), attempts: [], ratings: [] });
    assert.equal(insights.mostVisited.length, 5);
  });

  it('barShare', () => {
    assert.equal(barShare(2, 4), 0.5);
    assert.equal(barShare(1, 0), 0);
    assert.equal(barShare(9, 4), 1);
  });
});

// ---------------------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------------------

describe('certificates', () => {
  it('none until a province is complete', () => {
    assert.deepEqual(qualifyingCertificates(DESTINATIONS, [{ destination_id: 'Cavite-0', completed_at: day(1) }]), []);
  });

  it('a complete province qualifies, dated by its last visit', () => {
    const completions = DESTINATIONS.filter((d) => d.province === 'Rizal').map((d, i) => ({ destination_id: d.id, completed_at: day(i + 2) }));
    assert.deepEqual(qualifyingCertificates(DESTINATIONS, completions), [{ scope: 'Rizal', earnedAt: day(6), count: 5 }]);
  });

  it('all 26 → every province plus the region certificate, region last', () => {
    const completions = DESTINATIONS.map((d) => ({ destination_id: d.id, completed_at: day(1) }));
    const certificates = qualifyingCertificates(DESTINATIONS, completions);
    assert.deepEqual(certificates.map((c) => c.scope), [...PROVINCES, 'region']);
    assert.equal(certificates.at(-1)!.count, 26);
  });

  it('an empty catalogue never qualifies', () => {
    assert.deepEqual(qualifyingCertificates([], []), []);
  });

  it('parseScope accepts provinces and "region" only', () => {
    assert.equal(parseScope('Laguna'), 'Laguna');
    assert.equal(parseScope('region'), 'region');
    assert.equal(parseScope('Manila'), null);
    assert.equal(parseScope(undefined), null);
  });

  it('holder name: typed name, else email prefix, else fallback', () => {
    assert.equal(holderName('  Clark   Desepida ', 'x@y.z', 'Explorer'), 'Clark Desepida');
    assert.equal(holderName('', 'maria.santos@school.edu', 'Explorer'), 'maria.santos');
    assert.equal(holderName(null, null, 'Explorer'), 'Explorer');
    assert.equal(holderName('x'.repeat(80), null, 'E').length, 40);
  });
});

// ---------------------------------------------------------------------------
// Field trip planner
// ---------------------------------------------------------------------------

const STOP = (id: string, latitude: number, longitude: number): Stop => ({ id, name: id, latitude, longitude });
// Roughly west → east across the region.
const KAWIT = STOP('kawit', 14.4329, 120.8855);
const CALAMBA = STOP('calamba', 14.2117, 121.1653);
const PILA = STOP('pila', 14.2347, 121.3646);
const LUCBAN = STOP('lucban', 14.1137, 121.5562);
const TAAL = STOP('taal', 13.8805, 120.9238);

describe('planner: nearest-neighbour ordering', () => {
  it('starts from the first selection without a start point', () => {
    const order = orderNearestNeighbor([KAWIT, LUCBAN, CALAMBA, PILA]);
    assert.deepEqual(order.map((s) => s.id), ['kawit', 'calamba', 'pila', 'lucban']);
  });

  it('starts from the person’s location when given', () => {
    const fromLucban = orderNearestNeighbor([KAWIT, CALAMBA, PILA], { latitude: 14.11, longitude: 121.55 });
    assert.deepEqual(fromLucban.map((s) => s.id), ['pila', 'calamba', 'kawit']);
  });

  it('is greedy (always the closest unvisited stop next)', () => {
    const order = orderNearestNeighbor([TAAL, KAWIT, LUCBAN, CALAMBA]);
    for (let i = 1; i < order.length - 1; i += 1) {
      const here = order[i];
      const next = distanceKm(here, order[i + 1]);
      for (const later of order.slice(i + 2)) assert.ok(next <= distanceKm(here, later));
    }
  });

  it('handles 0 and 1 stops and never mutates its input', () => {
    assert.deepEqual(orderNearestNeighbor([]), []);
    assert.deepEqual(orderNearestNeighbor([KAWIT]), [KAWIT]);
    const input = [LUCBAN, KAWIT, CALAMBA];
    orderNearestNeighbor(input);
    assert.deepEqual(input.map((s) => s.id), ['lucban', 'kawit', 'calamba']);
  });
});

describe('planner: distances and time', () => {
  it('one leg per stop (plus the start leg); the total is their sum', () => {
    const stops = [KAWIT, CALAMBA, PILA];
    const legs = legsFor(stops);
    assert.equal(legs.length, 2);
    assert.equal(legs[0].fromId, 'kawit');
    assert.ok(Math.abs(totalKm(legs) - (distanceKm(KAWIT, CALAMBA) + distanceKm(CALAMBA, PILA))) < 1e-9);
    const fromHome = legsFor(stops, { latitude: 14.5, longitude: 121 });
    assert.equal(fromHome.length, 3);
    assert.equal(fromHome[0].fromId, null);
    assert.equal(totalKm([]), 0);
  });

  it('the time estimate is rounded to 5 minutes and grows with distance', () => {
    assert.equal(estimateDriveMinutes(0), 0);
    assert.equal(estimateDriveMinutes(1), 5);
    assert.equal(estimateDriveMinutes(35), 80); // 35 × 1.35 / 35 h = 81 min → 80
    assert.ok(estimateDriveMinutes(100) > estimateDriveMinutes(50));
    assert.deepEqual(splitMinutes(135), { hours: 2, minutes: 15 });
  });
});

describe('planner: Google Maps hand-off URL', () => {
  it('first stop as origin, middle stops as encoded waypoints, last as destination', () => {
    const url = buildDirectionsUrl([KAWIT, CALAMBA, PILA, LUCBAN])!;
    assert.equal(
      url,
      'https://www.google.com/maps/dir/?api=1&origin=14.4329%2C120.8855&destination=14.1137%2C121.5562&waypoints=14.2117%2C121.1653%7C14.2347%2C121.3646&travelmode=driving',
    );
    const waypoints = decodeURIComponent(new URL(url).searchParams.get('waypoints')!);
    assert.equal(waypoints, '14.2117,121.1653|14.2347,121.3646');
  });

  it('with the person’s location every stop comes after the origin', () => {
    const url = new URL(buildDirectionsUrl([KAWIT, CALAMBA], { latitude: 14.5, longitude: 121 })!);
    assert.equal(url.searchParams.get('origin'), '14.5,121');
    assert.equal(url.searchParams.get('waypoints'), '14.4329,120.8855');
    assert.equal(url.searchParams.get('destination'), '14.2117,121.1653');
  });

  it('two stops → no waypoints; one stop needs a start; none → null', () => {
    assert.ok(!buildDirectionsUrl([KAWIT, CALAMBA])!.includes('waypoints'));
    assert.equal(buildDirectionsUrl([KAWIT]), null);
    assert.ok(buildDirectionsUrl([KAWIT], { latitude: 14.5, longitude: 121 })!.includes('destination=14.4329%2C120.8855'));
    assert.equal(buildDirectionsUrl([]), null);
  });

  it(`caps the trip at ${MAX_STOPS} stops (6 waypoints without a start)`, () => {
    const ten = Array.from({ length: 10 }, (_, i) => STOP(`s${i}`, 14 + i / 100, 121 + i / 100));
    const url = new URL(buildDirectionsUrl(ten)!);
    assert.equal(url.searchParams.get('waypoints')!.split('|').length, MAX_STOPS - 2);
    assert.equal(url.searchParams.get('destination'), '14.07,121.07');
    const withStart = new URL(buildDirectionsUrl(ten, { latitude: 14.5, longitude: 121 })!);
    assert.equal(withStart.searchParams.get('waypoints')!.split('|').length, MAX_STOPS - 1);
  });
});

describe('planner: selection and manual reorder', () => {
  it('toggleSelection adds, removes and refuses a 9th stop', () => {
    let selected: string[] = [];
    for (let i = 0; i < 9; i += 1) selected = toggleSelection(selected, `s${i}`);
    assert.equal(selected.length, MAX_STOPS);
    assert.ok(!selected.includes('s8'));
    assert.deepEqual(toggleSelection(['a', 'b'], 'a'), ['b']);
  });

  it('moveItem swaps neighbours and ignores moves off the ends', () => {
    assert.deepEqual(moveItem(['a', 'b', 'c'], 1, -1), ['b', 'a', 'c']);
    assert.deepEqual(moveItem(['a', 'b', 'c'], 1, 1), ['a', 'c', 'b']);
    assert.deepEqual(moveItem(['a', 'b', 'c'], 0, -1), ['a', 'b', 'c']);
    assert.deepEqual(moveItem(['a', 'b', 'c'], 2, 1), ['a', 'b', 'c']);
  });
});

describe('saved trip plans (AsyncStorage store injected)', () => {
  function memoryStore() {
    const data = new Map<string, string>();
    return {
      data,
      getItem: async (key: string) => data.get(key) ?? null,
      setItem: async (key: string, value: string) => {
        data.set(key, value);
      },
    };
  }

  it('save, list newest first, rename by id, delete', async () => {
    const store = memoryStore();
    let tick = 0;
    const plans = createPlanStore(store, () => new Date(Date.UTC(2026, 10, 21, 8, tick++)));
    const one = await plans.save({ name: '  Cavite   loop ', stopIds: ['a', 'b'], fromLocation: false });
    assert.equal(one.name, 'Cavite loop');
    const two = await plans.save({ name: 'Laguna lakeshore', stopIds: ['c'], fromLocation: true });
    assert.deepEqual((await plans.list()).map((plan) => plan.id), [two.id, one.id]);
    const renamed = await plans.save({ id: one.id, name: 'Cavite heritage loop', stopIds: ['b', 'a'], fromLocation: false });
    assert.equal(renamed.createdAt, one.createdAt);
    const listed = await plans.list();
    assert.equal(listed.length, 2);
    assert.equal(listed[0].name, 'Cavite heritage loop');
    assert.deepEqual(listed[0].stopIds, ['b', 'a']);
    await plans.remove(two.id);
    assert.deepEqual((await plans.list()).map((plan) => plan.id), [one.id]);
    assert.ok(store.data.has(TRIP_PLANS_KEY));
  });

  it('never stores more than 8 stops; broken data reads as no plans', async () => {
    const plans = createPlanStore(memoryStore());
    const saved = await plans.save({ name: 'Too many', stopIds: Array.from({ length: 12 }, (_, i) => `s${i}`), fromLocation: false });
    assert.equal(saved.stopIds.length, MAX_STOPS);
    assert.deepEqual(parsePlans('{broken'), []);
    assert.deepEqual(parsePlans('[{"id":1}]'), []);
  });
});
