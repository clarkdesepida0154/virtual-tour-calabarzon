/// <reference types="node" />
/**
 * Unit tests for the Run 5 platform pass: theme tokens (both palettes,
 * contrast), i18n dictionaries and translator, the narration state machine,
 * settings parsing, photo credits and localized errors.
 *
 *   npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DICTIONARIES, createTranslator, tEnglish } from '../src/i18n';
import { compareDictionaries } from '../src/i18n/check';
import { en } from '../src/i18n/en';
import { fil } from '../src/i18n/fil';
import { interpolate, leafPaths, lookup, translate } from '../src/i18n/translate';
import { countCredits, groupCredits } from '../src/lib/credits';
import { validateDestinationForm, EMPTY_FORM_VALUES } from '../src/lib/destinationForm';
import { AppError, toAppError } from '../src/lib/errors';
import { formatDistance, formatDistanceValue } from '../src/lib/geo';
import {
  INITIAL_NARRATION,
  isNarrating,
  narrationReducer,
  pickSpeechLanguage,
  splitForSpeech,
} from '../src/lib/narration';
import type { NarrationEvent, NarrationState } from '../src/lib/narration';
import { DEFAULT_PREFERENCES, parsePreferences, resolveScheme } from '../src/lib/preferences';
import { contrastRatio, parseColor } from '../src/theme/contrast';
import { CONTRAST_PAIRS } from '../src/theme/contrastPairs';
import { darkMapStyle, lightMapStyle } from '../src/theme/mapStyles';
import { LIGHT_BEFORE_AUDIT, darkPalette, lightPalette } from '../src/theme/palettes';

// ---------------------------------------------------------------------------
// Theme tokens
// ---------------------------------------------------------------------------

describe('theme tokens', () => {
  it('both palettes define exactly the same tokens', () => {
    assert.deepEqual(Object.keys(darkPalette).sort(), Object.keys(lightPalette).sort());
  });

  it('every token is a valid colour', () => {
    for (const palette of [lightPalette, darkPalette]) {
      for (const [token, value] of Object.entries(palette)) {
        if (value === 'transparent') continue;
        assert.doesNotThrow(() => parseColor(value), `${token}: ${value}`);
      }
    }
  });

  it('keeps the design constants identical in both themes (gallery wall, text on photos)', () => {
    for (const token of ['exhibit', 'onExhibitSoft', 'onExhibitFaint', 'glass', 'onPhoto', 'onPhotoMuted', 'photoShadeStrong'] as const) {
      assert.equal(darkPalette[token], lightPalette[token], token);
    }
  });

  it('dark mode uses deep warm darks, not pure black', () => {
    assert.notEqual(darkPalette.background.toUpperCase(), '#000000');
    const { r, g, b } = parseColor(darkPalette.background);
    assert.ok(r > b, 'background should lean warm (more red than blue)');
    assert.ok(r + g + b > 0, 'not pure black');
  });

  for (const [name, palette] of [
    ['light', lightPalette],
    ['dark', darkPalette],
  ] as const) {
    it(`${name}: every text / icon pair meets WCAG AA`, () => {
      const failing = CONTRAST_PAIRS.map((pair) => ({
        ...pair,
        ratio: contrastRatio(palette[pair.fg], palette[pair.bg]),
      })).filter((pair) => pair.ratio < pair.min);
      assert.deepEqual(
        failing.map((pair) => `${pair.fg} on ${pair.bg}: ${pair.ratio.toFixed(2)} < ${pair.min}`),
        [],
      );
    });
  }

  it('the audit fixed the light pairs that failed before Run 5', () => {
    const before = { ...lightPalette, ...LIGHT_BEFORE_AUDIT };
    assert.ok(contrastRatio(before.muted, before.background) < 4.5, 'old muted failed');
    assert.ok(contrastRatio(lightPalette.muted, lightPalette.background) >= 4.5, 'new muted passes');
    assert.ok(contrastRatio(before.heroAccent, before.heroBackground) < 4.5, 'old hero overline failed');
    assert.ok(contrastRatio(lightPalette.heroAccent, lightPalette.heroBackground) >= 4.5, 'new hero overline passes');
  });

  it('computes contrast like WCAG (black on white = 21, same colour = 1)', () => {
    assert.equal(Math.round(contrastRatio('#000000', '#FFFFFF')), 21);
    assert.equal(contrastRatio('#9A3B26', '#9A3B26'), 1);
    // Translucent foregrounds are composited over the background first.
    assert.ok(contrastRatio('rgba(255, 255, 255, 0.5)', '#000000') > 5);
  });

  it('has a light and a dark Google Maps style that hide POIs', () => {
    for (const style of [lightMapStyle, darkMapStyle]) {
      assert.ok(style.some((rule) => rule.featureType === 'poi' && rule.stylers.some((s) => s.visibility === 'off')));
    }
    assert.notDeepEqual(lightMapStyle, darkMapStyle);
  });
});

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

describe('i18n dictionaries', () => {
  it('English and Filipino have the same keys, placeholders and plural shapes', () => {
    assert.deepEqual(compareDictionaries(en, fil), []);
  });

  it('flags a missing key and mismatched placeholders', () => {
    const problems = compareDictionaries({ a: 'Hi {{name}}', b: 'x' }, { a: 'Kumusta {{who}}' });
    assert.ok(problems.some((p) => p.key === 'b' && /missing in fil/.test(p.problem)));
    assert.ok(problems.some((p) => p.key === 'a' && /placeholders differ/.test(p.problem)));
  });

  it('Filipino is really translated (most strings differ from English)', () => {
    const keys = leafPaths(en);
    const same = keys.filter((key) => JSON.stringify(lookup(en, key)) === JSON.stringify(lookup(fil, key)));
    // Proper nouns, "Email", "Quiz", provinces etc. may match; real UI text must not.
    assert.ok(same.length / keys.length < 0.15, `${same.length} of ${keys.length} identical: ${same.slice(0, 12).join(', ')}`);
  });

  it('reads like a Philippine app (spot checks)', () => {
    const t = createTranslator('fil');
    assert.equal(t('progress.favorites.title'), 'Mga Paborito');
    assert.equal(t('common.save'), 'I-save');
    assert.equal(t('tabs.explore'), 'Tuklasin');
    assert.equal(t('explore.count', { count: 26 }), '26 destinasyon');
  });

  it('translates, interpolates and picks plural forms', () => {
    const t = createTranslator('en');
    assert.equal(t('explore.count', { count: 1 }), '1 destination');
    assert.equal(t('explore.count', { count: 26 }), '26 destinations');
    assert.equal(t('details.quizBest', { score: 4, total: 5 }), 'Quiz · 4/5');
    assert.equal(interpolate('{{a}} and {{ b }}', { a: 1, b: 'two' }), '1 and two');
    assert.equal(interpolate('keep {{missing}}', {}), 'keep {{missing}}');
  });

  it('falls back to English, then to the key itself', () => {
    assert.equal(translate({}, 'tabs.map', undefined, en), 'Map');
    assert.equal(translate({}, 'no.such.key', undefined, en), 'no.such.key');
    assert.equal(Object.keys(DICTIONARIES).sort().join(), 'en,fil');
  });

  it('keeps the English UI wording the tests and click-through rely on', () => {
    assert.equal(tEnglish('tour.complete.markVisited'), 'Mark as Visited');
    assert.equal(tEnglish('tour.gallery.plate', { index: 1, count: 3 }), 'Plate 1 of 3 · swipe to browse');
    assert.equal(tEnglish('quiz.feedbackCorrect'), 'Correct — well done!');
    assert.equal(tEnglish('nearMe.away', { distance: '12.4 km' }), '12.4 km away');
  });

  it('every validation message the form can produce exists in both languages', () => {
    const errors = validateDestinationForm({ ...EMPTY_FORM_VALUES, latitude: 'abc', longitude: '' });
    const keys = Object.values(errors);
    assert.ok(keys.length >= 5);
    for (const key of keys) {
      assert.ok(lookup(en, key!) && lookup(fil, key!), `missing text for ${key}`);
    }
  });
});

describe('localized errors', () => {
  it('carries a message key and keeps the English text (for logs and scripts)', () => {
    const error = toAppError(new TypeError('Network request failed'), 'loadDestinations');
    assert.ok(error instanceof AppError);
    assert.equal(error.kind, 'network');
    assert.equal(error.contextKey, 'errors.context.loadDestinations');
    assert.equal(error.message, 'We couldn’t load the destinations. Check your internet connection and try again.');
    assert.equal(error.title, 'No connection');
    assert.equal(toAppError(new Error('boom'), 'saveScore').message, 'We couldn’t save your score. Please try again.');
  });

  it('distances: language-neutral value, English wording unchanged', () => {
    assert.equal(formatDistanceValue(12.43), '12.4 km');
    assert.equal(formatDistanceValue(0.01), 'under-50');
    assert.equal(formatDistanceValue(-1), null);
    assert.equal(formatDistance(0.853), '850 m away');
    assert.equal(createTranslator('fil')('nearMe.away', { distance: '12.4 km' }), '12.4 km ang layo');
  });
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

describe('settings (preferences)', () => {
  it('defaults to System theme, English, narration on at normal speed', () => {
    assert.deepEqual(parsePreferences(null), DEFAULT_PREFERENCES);
    assert.deepEqual(DEFAULT_PREFERENCES, { theme: 'system', locale: 'en', narration: true, speechRate: 'normal' });
  });

  it('keeps valid values and replaces invalid ones with defaults', () => {
    assert.deepEqual(parsePreferences('{"theme":"dark","locale":"fil","narration":false,"speechRate":"slow"}'), {
      theme: 'dark',
      locale: 'fil',
      narration: false,
      speechRate: 'slow',
    });
    assert.deepEqual(parsePreferences('{"theme":"purple","locale":"jp","narration":"yes"}'), DEFAULT_PREFERENCES);
    assert.deepEqual(parsePreferences('not json'), DEFAULT_PREFERENCES);
    assert.deepEqual(parsePreferences('[1,2]'), DEFAULT_PREFERENCES);
  });

  it('resolves System to the phone setting, and explicit choices win', () => {
    assert.equal(resolveScheme('system', 'dark'), 'dark');
    assert.equal(resolveScheme('system', 'light'), 'light');
    assert.equal(resolveScheme('system', null), 'light');
    assert.equal(resolveScheme('light', 'dark'), 'light');
    assert.equal(resolveScheme('dark', 'light'), 'dark');
  });
});

// ---------------------------------------------------------------------------
// Narration
// ---------------------------------------------------------------------------

const run = (events: NarrationEvent[], from: NarrationState = INITIAL_NARRATION) =>
  events.reduce(narrationReducer, from);

describe('narration state machine', () => {
  it('becomes idle when a voice exists, unavailable when none does', () => {
    assert.equal(run([{ type: 'voices', available: true }]).status, 'idle');
    assert.equal(run([{ type: 'voices', available: false }]).status, 'unavailable');
    // An unavailable narrator ignores play.
    assert.equal(run([{ type: 'voices', available: false }, { type: 'play' }]).status, 'unavailable');
  });

  it('plays, speaks, and returns to idle when done', () => {
    const playing = run([{ type: 'voices', available: true }, { type: 'play' }]);
    assert.equal(playing.status, 'starting');
    assert.ok(isNarrating(playing));
    const speaking = narrationReducer(playing, { type: 'started', utterance: playing.utterance });
    assert.equal(speaking.status, 'speaking');
    const done = narrationReducer(speaking, { type: 'done', utterance: speaking.utterance });
    assert.equal(done.status, 'idle');
    assert.equal(isNarrating(done), false);
  });

  it('stop works while starting or speaking; errors end the utterance', () => {
    const playing = run([{ type: 'voices', available: true }, { type: 'play' }]);
    assert.equal(narrationReducer(playing, { type: 'stop' }).status, 'idle');
    assert.equal(narrationReducer(playing, { type: 'error', utterance: playing.utterance }).status, 'idle');
  });

  it('ignores late callbacks from an earlier utterance', () => {
    const first = run([{ type: 'voices', available: true }, { type: 'play' }]);
    const stopped = narrationReducer(first, { type: 'stop' });
    const second = narrationReducer(stopped, { type: 'play' });
    assert.equal(second.utterance, first.utterance + 1);
    // The first utterance's "done" arrives late: the second keeps playing.
    const afterLateDone = narrationReducer(second, { type: 'done', utterance: first.utterance });
    assert.equal(afterLateDone.status, 'starting');
    const afterLateStart = narrationReducer(second, { type: 'started', utterance: first.utterance });
    assert.equal(afterLateStart.status, 'starting');
  });

  it('splits long chapters at sentence ends within the engine limit', () => {
    assert.deepEqual(splitForSpeech('  '), []);
    assert.deepEqual(splitForSpeech('Short text.'), ['Short text.']);
    const text = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(' ');
    const pieces = splitForSpeech(text, 120);
    assert.ok(pieces.length > 1);
    assert.ok(pieces.every((piece) => piece.length <= 120), 'piece too long');
    assert.ok(pieces.every((piece) => piece.endsWith('.')), 'cut mid-sentence');
    assert.equal(pieces.join(' '), text);
    // One giant sentence is cut at spaces.
    const giant = splitForSpeech('word '.repeat(100).trim(), 50);
    assert.ok(giant.every((piece) => piece.length <= 50));
  });

  it('prefers a Philippine English voice, then US English, then any English', () => {
    assert.equal(pickSpeechLanguage([{ language: 'en-US' }, { language: 'en-PH' }]), 'en-PH');
    assert.equal(pickSpeechLanguage([{ language: 'fil-PH' }, { language: 'en_US' }]), 'en-US');
    assert.equal(pickSpeechLanguage([{ language: 'en-GB' }]), 'en-GB');
    assert.equal(pickSpeechLanguage([{ language: 'fil-PH' }]), null);
    assert.equal(pickSpeechLanguage([]), null);
  });
});

// ---------------------------------------------------------------------------
// Photo credits
// ---------------------------------------------------------------------------

describe('photo credits', () => {
  const destinations = [
    { id: 'b', name: 'Beta Falls', province: 'Laguna' as const },
    { id: 'a', name: 'Alpha Shrine', province: 'Cavite' as const },
    { id: 'c', name: 'No Photos', province: 'Rizal' as const },
  ];
  const images = [
    { id: 'b2', destination_id: 'b', caption: 'Photo: B2, CC BY 4.0, via Wikimedia Commons', sort_order: 2 },
    { id: 'b0', destination_id: 'b', caption: 'Photo: B0, CC0, via Wikimedia Commons', sort_order: 0 },
    { id: 'a0', destination_id: 'a', caption: 'Photo: A0, Public domain, via Wikimedia Commons', sort_order: 0 },
    { id: 'a1', destination_id: 'a', caption: '   ', sort_order: 1 },
    { id: 'x0', destination_id: 'gone', caption: 'Photo: X, CC0, via Wikimedia Commons', sort_order: 0 },
  ];

  it('groups credits by destination A–Z, cover first, skipping blanks and unknown destinations', () => {
    const groups = groupCredits(destinations, images);
    assert.deepEqual(groups.map((group) => group.destination.name), ['Alpha Shrine', 'Beta Falls']);
    assert.deepEqual(groups[1].credits.map((line) => line.id), ['b0', 'b2']);
    assert.equal(countCredits(groups), 3);
  });
});
