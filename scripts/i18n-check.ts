/**
 * i18n gate — run before every commit:   npm run i18n:check
 *
 * 1. Dictionaries: every key exists in both English and Filipino, with the
 *    same `{{placeholders}}`, the same plural shape, and no empty text.
 * 2. Code sweep: screens and components (src/app, src/components) must not
 *    contain user-visible English outside the t() path — JSX text, and string
 *    literals in UI props (label, title, message, placeholder, accessibility
 *    label / hint, …). Proper nouns and technical values are allowlisted
 *    below, each with a reason.
 *
 * Exits 1 on any problem.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { compareDictionaries } from '../src/i18n/check';
import { en } from '../src/i18n/en';
import { fil } from '../src/i18n/fil';
import { leafPaths } from '../src/i18n/translate';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['src/app', 'src/components'];

/** Literal text that is allowed outside t(), and why. */
const ALLOWED_TEXT: { pattern: RegExp; reason: string }[] = [
  { pattern: /^Photo: .+ via Wikimedia Commons$/, reason: 'licence credit line — must stay verbatim' },
  { pattern: /^[A-D]$/, reason: 'quiz option letters' },
  { pattern: /^[IVX]+$/, reason: 'Roman chapter numerals' },
  { pattern: /^\d[\d.]*$/, reason: 'example coordinates (14.2136)' },
];

/** UI props whose string value is shown or read aloud. */
const UI_PROPS = [
  'label',
  'title',
  'subtitle',
  'overline',
  'message',
  'placeholder',
  'helper',
  'actionLabel',
  'confirmLabel',
  'cancelLabel',
  'accessibilityLabel',
  'accessibilityHint',
  'description',
];

type Finding = { file: string; line: number; text: string };

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split('\n').length;
}

const isAllowed = (text: string) => ALLOWED_TEXT.some(({ pattern }) => pattern.test(text.trim()));
const hasWords = (text: string) => /[A-Za-z]{2,}/.test(text);

function sweep(file: string): Finding[] {
  const source = readFileSync(file, 'utf8')
    // ignore comments
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/.*$/gm, (match, lead: string) => lead + ' '.repeat(match.length - lead.length));
  const findings: Finding[] = [];
  const rel = relative(ROOT, file).replace(/\\/g, '/');

  // JSX text between tags: >Some words<
  for (const match of source.matchAll(/>([^<>{}]*[A-Za-z][^<>{}]*)</g)) {
    const text = match[1].trim();
    if (!text || !hasWords(text) || isAllowed(text)) continue;
    // Skip TypeScript generics and arrow bodies that look like `=> (` … `<`
    if (/[;=()]|\bconst\b|\breturn\b/.test(text)) continue;
    findings.push({ file: rel, line: lineOf(source, match.index ?? 0), text });
  }

  // String literals in UI props: label="…", title={'…'}, accessibilityLabel={`…`}
  const props = UI_PROPS.join('|');
  const propPattern = new RegExp(`\\b(${props})=(?:"([^"]*)"|\\{\\s*'([^']*)'\\s*\\}|\\{\\s*\`([^\`]*)\`\\s*\\})`, 'g');
  for (const match of source.matchAll(propPattern)) {
    const text = (match[2] ?? match[3] ?? match[4] ?? '').replace(/\$\{[^}]*\}/g, '').trim();
    if (!text || !hasWords(text) || isAllowed(text)) continue;
    findings.push({ file: rel, line: lineOf(source, match.index ?? 0), text: `${match[1]}="${text}"` });
  }

  // showToast('…') with a literal
  for (const match of source.matchAll(/showToast\(\s*(['"`])([^'"`]*[A-Za-z]{2,}[^'"`]*)\1/g)) {
    findings.push({ file: rel, line: lineOf(source, match.index ?? 0), text: `showToast("${match[2]}")` });
  }
  return findings;
}

const dictionaryProblems = compareDictionaries(en, fil);
const files = SCAN_DIRS.flatMap((dir) => walk(join(ROOT, dir)));
const findings = files.flatMap(sweep);

const keys = leafPaths(en).length;
console.log(`Dictionaries: ${keys} keys in en, ${leafPaths(fil).length} in fil`);
if (dictionaryProblems.length === 0) console.log('  ok  every key in both languages, same placeholders, no empty text');
for (const { key, problem } of dictionaryProblems) console.log(`  FAIL ${key}: ${problem}`);

console.log(`\nCode sweep: ${files.length} screen / component files`);
if (findings.length === 0) console.log('  ok  no hard-coded UI text outside t()');
for (const { file, line, text } of findings) console.log(`  FAIL ${file}:${line}  ${text}`);

console.log(`\nAllowlist (${ALLOWED_TEXT.length}):`);
for (const { pattern, reason } of ALLOWED_TEXT) console.log(`  ${pattern}  — ${reason}`);

const total = dictionaryProblems.length + findings.length;
console.log(`\n${total === 0 ? 'i18n check passed' : `i18n check FAILED: ${total} problem(s)`}`);
process.exit(total === 0 ? 0 : 1);
