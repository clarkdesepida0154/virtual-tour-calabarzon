/**
 * Auto-generated starter quiz for a destination a user added in the app
 * (Run 6). Pure — no React Native imports — so it is unit-tested in Node.
 *
 * The rule that matters: every question's correct answer comes from the
 * record the user entered (name, province, municipality, category,
 * description). Distractors come from fixed lists (provinces, categories,
 * regions) or from OTHER catalogue entries, so exactly one option is right.
 *
 * Five slots, each filled by the first generator that can build a sound
 * question and has not been used yet:
 *
 *   1. province           — "In which province is X?"   (the other 4 provinces)
 *   2. municipality       — town / city of X             (other catalogue towns)
 *        → fallback: name by category + province, statement, region
 *   3. category           — how X is classified          (3 of the other 4)
 *   4. identify           — "Which destination is described here?" (masked lead sentence)
 *        → fallback: name by category + province, statement, region
 *   5. cloze              — missing word from the description (when it is rich enough)
 *        → fallback: statement, name by category + province, region, true/false
 *
 * Deterministic: the same input and seed always give the same quiz (options
 * are shuffled again by `prepareQuiz()` for every attempt anyway).
 */
import { CATEGORIES, PROVINCES } from '@/constants/taxonomy';
import type { Category, Province } from '@/constants/taxonomy';

export const AUTO_QUIZ_SIZE = 5;

/** The fields of the user's own record that the generator may draw answers from. */
export type QuizSourceRecord = {
  id?: string;
  name: string;
  description: string;
  municipality: string | null;
  province: Province;
  category: Category;
};

/** Other destinations, for distractors only (never for correct answers). */
export type CatalogueEntry = {
  id?: string;
  name: string;
  municipality: string | null;
  province: Province;
  category: Category;
};

export type GeneratedOption = { option_text: string; is_correct: boolean };

export type GeneratedQuestion = {
  question_text: string;
  sort_order: number;
  kind: QuestionKind;
  options: GeneratedOption[];
};

export type QuestionKind =
  | 'province'
  | 'municipality'
  | 'category'
  | 'identify'
  | 'cloze'
  | 'nameByCategoryProvince'
  | 'statement'
  | 'region'
  | 'trueFalse';

/** Below this the description is not "rich enough" for a fill-in-the-blank question. */
export const CLOZE_MIN_WORDS = 14;
const CLOZE_MIN_WORD_LENGTH = 6;
const MAX_DISTRACTORS = 3;

/** CALABARZON is Region IV-A; the others are well-known Luzon regions, as distractors. */
const REGION_ANSWER = 'Region IV-A (CALABARZON)';
const REGION_DISTRACTORS = ['Region III (Central Luzon)', 'Region V (Bicol Region)', 'National Capital Region (Metro Manila)'];

/** Common English words that make poor blanks. */
const STOPWORDS = new Set(
  'about above after again against along among another around because before behind being below beneath beside between beyond during either enough every further having inside itself little middle others outside people rather should something sometimes through toward towards under until upward whether which while within without would there their these those where years still often known since being including became become'.split(
    ' ',
  ),
);

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/** FNV-1a hash of a string → 32-bit seed. */
export function hashSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a tiny seeded PRNG returning numbers in [0, 1). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const norm = (text: string) => text.trim().replace(/\s+/g, ' ').toLowerCase();
const clean = (text: string | null | undefined) => (text ?? '').trim().replace(/\s+/g, ' ');

/** Distinct (case-insensitive) values, keeping the first spelling, minus any in `exclude`. */
function distinct(values: readonly string[], exclude: readonly string[] = []): string[] {
  const seen = new Set(exclude.map(norm));
  const result: string[] = [];
  for (const value of values) {
    const text = clean(value);
    if (!text || seen.has(norm(text))) continue;
    seen.add(norm(text));
    result.push(text);
  }
  return result;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The first sentence of a text (or the whole text when it has no full stop). */
export function firstSentence(text: string): string {
  const flat = clean(text);
  const match = flat.match(/^(.+?[.!?])(\s|$)/);
  return (match ? match[1] : flat).trim();
}

/** Replaces the destination's name (and its main words) in a sentence with "this place". */
export function maskName(sentence: string, name: string): string {
  let masked = sentence;
  const full = clean(name);
  if (full) masked = masked.replace(new RegExp(escapeRegExp(full), 'gi'), 'this place');
  return masked;
}

function wordsOf(text: string): string[] {
  return clean(text).split(' ').filter(Boolean);
}

/** A word worth blanking out: long, alphabetic, not a stopword, not part of the name. */
function isClozeCandidate(word: string, nameWords: Set<string>): boolean {
  const bare = word.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '');
  if (bare.length < CLOZE_MIN_WORD_LENGTH) return false;
  if (!/^[A-Za-zÀ-ÿ-]+$/.test(bare)) return false;
  const lower = bare.toLowerCase();
  return !STOPWORDS.has(lower) && !nameWords.has(lower);
}

const bareWord = (word: string) => word.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '');

// ---------------------------------------------------------------------------
// Question builders — each returns null when it cannot build a sound question
// ---------------------------------------------------------------------------

type Context = {
  record: QuizSourceRecord;
  others: CatalogueEntry[];
  random: () => number;
};

type Draft = { kind: QuestionKind; question_text: string; correct: string; distractors: string[] };

function provinceQuestion({ record }: Context): Draft {
  return {
    kind: 'province',
    question_text: `In which province is ${clean(record.name)}?`,
    correct: record.province,
    distractors: PROVINCES.filter((province) => province !== record.province),
  };
}

function municipalityQuestion({ record, others, random }: Context): Draft | null {
  const town = clean(record.municipality);
  if (!town) return null;
  const pool = distinct(shuffled(others.map((entry) => entry.municipality ?? ''), random), [town]);
  if (pool.length === 0) return null;
  return {
    kind: 'municipality',
    question_text: `${clean(record.name)} is in which town or city?`,
    correct: town,
    distractors: pool.slice(0, MAX_DISTRACTORS),
  };
}

function categoryQuestion({ record, random }: Context): Draft {
  const others = CATEGORIES.filter((category) => category !== record.category);
  return {
    kind: 'category',
    question_text: `How is ${clean(record.name)} classified in this collection?`,
    correct: record.category,
    distractors: shuffled(others, random).slice(0, MAX_DISTRACTORS),
  };
}

function identifyQuestion({ record, others, random }: Context): Draft | null {
  const lead = firstSentence(record.description);
  const masked = maskName(lead, record.name);
  // Too short to describe anything, or it still gives the answer away.
  if (wordsOf(masked).length < 5 || norm(masked).includes(norm(record.name))) return null;
  const pool = distinct(shuffled(others.map((entry) => entry.name), random), [record.name]);
  if (pool.length === 0) return null;
  return {
    kind: 'identify',
    question_text: `Which destination is described here? “${masked}”`,
    correct: clean(record.name),
    distractors: pool.slice(0, MAX_DISTRACTORS),
  };
}

function clozeQuestion({ record, random }: Context): Draft | null {
  const words = wordsOf(record.description);
  if (words.length < CLOZE_MIN_WORDS) return null;
  const nameWords = new Set(wordsOf(record.name).map((word) => bareWord(word).toLowerCase()));
  const candidates = words
    .map((word, index) => ({ word: bareWord(word), index }))
    .filter(({ word }, index) => isClozeCandidate(words[index], nameWords) && word.length > 0);
  const unique = distinct(candidates.map((candidate) => candidate.word));
  if (unique.length < 1 + MAX_DISTRACTORS) return null;

  // The blank: one of the longer candidate words (deterministic pick among the top half).
  const ranked = [...unique].sort((a, b) => b.length - a.length || a.localeCompare(b));
  const top = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 2)));
  const answer = top[Math.floor(random() * top.length)];
  const position = candidates.find((candidate) => norm(candidate.word) === norm(answer))!.index;

  // Show the sentence around the blank (not the whole description).
  const start = Math.max(0, position - 9);
  const end = Math.min(words.length, position + 10);
  const excerpt = words
    .slice(start, end)
    .map((word, offset) => (start + offset === position ? word.replace(bareWord(word), '_____') : word))
    .join(' ');
  const masked = maskName(excerpt, record.name);
  const distractors = shuffled(
    unique.filter((word) => norm(word) !== norm(answer)),
    random,
  ).slice(0, MAX_DISTRACTORS);
  return {
    kind: 'cloze',
    question_text: `Which word completes your description? “${start > 0 ? '…' : ''}${masked}${end < words.length ? '…' : ''}”`,
    correct: answer,
    distractors,
  };
}

function nameByCategoryProvinceQuestion({ record, others, random }: Context): Draft | null {
  // Only places that are NOT this category in this province, so one answer fits.
  const pool = distinct(
    shuffled(
      others.filter((entry) => !(entry.category === record.category && entry.province === record.province)),
      random,
    ).map((entry) => entry.name),
    [record.name],
  );
  // Another catalogue entry with the same category + province would make the
  // question ambiguous — skip it then.
  const twin = others.some(
    (entry) => entry.category === record.category && entry.province === record.province && norm(entry.name) !== norm(record.name),
  );
  if (twin || pool.length === 0) return null;
  return {
    kind: 'nameByCategoryProvince',
    question_text: `Which of these is a ${record.category} in ${record.province}?`,
    correct: clean(record.name),
    distractors: pool.slice(0, MAX_DISTRACTORS),
  };
}

function statementQuestion({ record, random }: Context): Draft {
  const wrongProvinces = shuffled(PROVINCES.filter((province) => province !== record.province), random);
  const wrongCategories = shuffled(CATEGORIES.filter((category) => category !== record.category), random);
  return {
    kind: 'statement',
    question_text: `Which statement about ${clean(record.name)} is correct?`,
    correct: `It is a ${record.category} in ${record.province}.`,
    distractors: [
      `It is a ${record.category} in ${wrongProvinces[0]}.`,
      `It is a ${wrongCategories[0]} in ${record.province}.`,
      `It is a ${wrongCategories[1]} in ${wrongProvinces[1]}.`,
    ],
  };
}

function regionQuestion({ record, random }: Context): Draft {
  return {
    kind: 'region',
    question_text: `${clean(record.name)}, in ${record.province}, belongs to which region of the Philippines?`,
    correct: REGION_ANSWER,
    distractors: shuffled(REGION_DISTRACTORS, random),
  };
}

/** "True or false: X is a <category> in <province>?" — the claim is right or wrong by a seeded coin. */
function trueFalseQuestion({ record, random }: Context): Draft {
  const truthful = random() < 0.5;
  const wrongProvince = shuffled(PROVINCES.filter((province) => province !== record.province), random)[0];
  const province = truthful ? record.province : wrongProvince;
  return {
    kind: 'trueFalse',
    question_text: `True or false: ${clean(record.name)} is in ${province}.`,
    correct: truthful ? 'True' : 'False',
    distractors: [truthful ? 'False' : 'True'],
  };
}

type Builder = (context: Context) => Draft | null;

const BUILDERS: Record<QuestionKind, Builder> = {
  province: provinceQuestion,
  municipality: municipalityQuestion,
  category: categoryQuestion,
  identify: identifyQuestion,
  cloze: clozeQuestion,
  nameByCategoryProvince: nameByCategoryProvinceQuestion,
  statement: statementQuestion,
  region: regionQuestion,
  trueFalse: trueFalseQuestion,
};

/**
 * Each slot's generators, in order of preference. `statement`, `region` and
 * `trueFalse` always work, so every slot can be filled even with an empty
 * catalogue and a one-line description.
 */
export const SLOTS: readonly (readonly QuestionKind[])[] = [
  ['province'],
  ['municipality', 'nameByCategoryProvince', 'statement', 'region', 'trueFalse'],
  ['category'],
  ['identify', 'nameByCategoryProvince', 'statement', 'region', 'trueFalse'],
  ['cloze', 'statement', 'nameByCategoryProvince', 'region', 'trueFalse'],
];

function toQuestion(draft: Draft, sortOrder: number, random: () => number): GeneratedQuestion {
  const distractors = distinct(draft.distractors, [draft.correct]);
  const options: GeneratedOption[] = [
    { option_text: clean(draft.correct), is_correct: true },
    ...distractors.map((text) => ({ option_text: text, is_correct: false })),
  ];
  return {
    kind: draft.kind,
    question_text: draft.question_text,
    sort_order: sortOrder,
    options: shuffled(options, random),
  };
}

/**
 * Builds the 5-question starter quiz for `record`. `catalogue` may include
 * the record itself (it is filtered out by id and by name). `seed` defaults
 * to the record's id (or name), so regenerating the same entry gives the
 * same quiz.
 */
export function generateQuiz(
  record: QuizSourceRecord,
  catalogue: readonly CatalogueEntry[],
  seed: string = record.id ?? record.name,
): GeneratedQuestion[] {
  const random = seededRandom(hashSeed(seed));
  const others = catalogue.filter(
    (entry) => !(record.id && entry.id === record.id) && norm(entry.name) !== norm(record.name),
  );
  const context: Context = { record, others, random };
  const used = new Set<QuestionKind>();
  const questions: GeneratedQuestion[] = [];

  for (const slot of SLOTS) {
    for (const kind of slot) {
      if (used.has(kind)) continue;
      const draft = BUILDERS[kind](context);
      if (!draft) continue;
      if (distinct(draft.distractors, [draft.correct]).length === 0) continue;
      used.add(kind);
      questions.push(toQuestion(draft, questions.length + 1, random));
      break;
    }
  }
  return questions;
}

/** Fields whose change makes the starter quiz out of date. */
export const AUTO_QUIZ_FIELDS = ['name', 'description', 'municipality', 'province', 'category'] as const;

/** Whether an edit touched any field the starter quiz is built from. */
export function quizFieldsChanged(
  before: Pick<QuizSourceRecord, (typeof AUTO_QUIZ_FIELDS)[number]>,
  after: Pick<QuizSourceRecord, (typeof AUTO_QUIZ_FIELDS)[number]>,
): boolean {
  return AUTO_QUIZ_FIELDS.some((field) => clean(before[field] ?? '') !== clean(after[field] ?? ''));
}
