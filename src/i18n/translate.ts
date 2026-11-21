/**
 * Tiny typed translator — no framework. Pure: the unit tests and
 * scripts/i18n-check.ts use it in Node.
 *
 * - Keys are dot paths into the English dictionary (`'home.featured.title'`),
 *   checked by TypeScript, so a typo is a compile error.
 * - `{{name}}` placeholders are filled from `params`.
 * - A leaf may be `{ one, other }`; `params.count` picks the form.
 */
export type PluralLeaf = { one: string; other: string };

/** Same shape as `T`, every leaf a string (or a plural pair). */
export type DictionaryShape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends PluralLeaf ? PluralLeaf : DictionaryShape<T[K]>;
};

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : T[K] extends PluralLeaf
      ? `${Prefix}${K}`
      : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type KeysOf<T> = Leaves<T>;

export type TranslateParams = Record<string, string | number>;

function isPlural(value: unknown): value is PluralLeaf {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PluralLeaf).one === 'string' &&
    typeof (value as PluralLeaf).other === 'string'
  );
}

/** Looks up a dot path; returns `undefined` when it does not lead to a leaf. */
export function lookup(dictionary: unknown, key: string): string | PluralLeaf | undefined {
  let node: unknown = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' || isPlural(node) ? node : undefined;
}

export function interpolate(template: string, params: TranslateParams = {}): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Translates `key` with `dictionary`, falling back to `fallback` (English)
 * and finally to the key itself, so a missing string is visible, not blank.
 */
export function translate(
  dictionary: unknown,
  key: string,
  params?: TranslateParams,
  fallback?: unknown,
): string {
  const found = lookup(dictionary, key) ?? (fallback ? lookup(fallback, key) : undefined);
  if (found === undefined) return key;
  const template = isPlural(found) ? (Number(params?.count) === 1 ? found.one : found.other) : found;
  return interpolate(template, params);
}

/** Every leaf path of a dictionary (plural pairs count as one leaf). */
export function leafPaths(dictionary: unknown, prefix = ''): string[] {
  if (typeof dictionary !== 'object' || dictionary === null) return [];
  return Object.entries(dictionary as Record<string, unknown>).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string' || isPlural(value)) return [path];
    return leafPaths(value, path);
  });
}

/** The `{{placeholders}}` used by a leaf (both plural forms together). */
export function placeholders(leaf: string | PluralLeaf): string[] {
  const text = typeof leaf === 'string' ? leaf : `${leaf.one} ${leaf.other}`;
  return [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]))].sort();
}
