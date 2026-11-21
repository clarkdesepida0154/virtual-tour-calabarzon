/**
 * Dictionary consistency rules, shared by `npm run i18n:check`
 * (scripts/i18n-check.ts) and the unit tests. Pure.
 */
import { leafPaths, lookup, placeholders } from '@/i18n/translate';

/** Keys whose value may legitimately be empty (an error kind with no suffix). */
const MAY_BE_EMPTY = /^errors\.suffix\./;

export type DictionaryProblem = { key: string; problem: string };

export function compareDictionaries(
  reference: unknown,
  other: unknown,
  names: { reference: string; other: string } = { reference: 'en', other: 'fil' },
): DictionaryProblem[] {
  const problems: DictionaryProblem[] = [];
  const referenceKeys = new Set(leafPaths(reference));
  const otherKeys = new Set(leafPaths(other));

  for (const key of referenceKeys) {
    if (!otherKeys.has(key)) problems.push({ key, problem: `missing in ${names.other}` });
  }
  for (const key of otherKeys) {
    if (!referenceKeys.has(key)) problems.push({ key, problem: `missing in ${names.reference} (extra in ${names.other})` });
  }

  for (const key of referenceKeys) {
    if (!otherKeys.has(key)) continue;
    const a = lookup(reference, key);
    const b = lookup(other, key);
    if (a === undefined || b === undefined) continue;
    if (typeof a !== typeof b) {
      problems.push({ key, problem: 'one language has a plural pair, the other a plain string' });
      continue;
    }
    const pa = placeholders(a).join(',');
    const pb = placeholders(b).join(',');
    if (pa !== pb) problems.push({ key, problem: `placeholders differ: ${names.reference} {${pa}} vs ${names.other} {${pb}}` });
    for (const [name, leaf] of [
      [names.reference, a],
      [names.other, b],
    ] as const) {
      const texts = typeof leaf === 'string' ? [leaf] : [leaf.one, leaf.other];
      if (texts.some((text) => !text.trim()) && !MAY_BE_EMPTY.test(key)) {
        problems.push({ key, problem: `empty text in ${name}` });
      }
    }
  }
  return problems;
}
