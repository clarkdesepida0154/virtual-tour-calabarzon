/**
 * Audio narration (the tour's museum audio guide) — the logic, without the
 * speech engine. Pure, so the state machine is unit-tested in Node; the
 * expo-speech side lives in src/hooks/useNarration.ts.
 *
 *   checking ──voices──▶ idle ◀──────────────┐
 *      │                  │ play             │ done / stop / error
 *      └─no voice─▶ unavailable              │
 *                         ▼                  │
 *                      starting ──started──▶ speaking
 *
 * Every play gets a new utterance number; engine callbacks carry the number
 * they belong to, so a late "done" from an utterance that was already
 * stopped can never end the next one.
 */

export type NarrationStatus = 'checking' | 'unavailable' | 'idle' | 'starting' | 'speaking';

export type NarrationState = {
  status: NarrationStatus;
  /** The current (or last) utterance number. */
  utterance: number;
};

export type NarrationEvent =
  | { type: 'voices'; available: boolean }
  | { type: 'play' }
  | { type: 'started'; utterance: number }
  | { type: 'done'; utterance: number }
  | { type: 'error'; utterance: number }
  | { type: 'stop' };

export const INITIAL_NARRATION: NarrationState = { status: 'checking', utterance: 0 };

export function narrationReducer(state: NarrationState, event: NarrationEvent): NarrationState {
  switch (event.type) {
    case 'voices':
      if (state.status !== 'checking') return state;
      return { ...state, status: event.available ? 'idle' : 'unavailable' };
    case 'play':
      if (state.status !== 'idle') return state;
      return { status: 'starting', utterance: state.utterance + 1 };
    case 'started':
      if (event.utterance !== state.utterance || state.status !== 'starting') return state;
      return { ...state, status: 'speaking' };
    case 'done':
    case 'error':
      if (event.utterance !== state.utterance) return state;
      if (state.status !== 'starting' && state.status !== 'speaking') return state;
      return { ...state, status: 'idle' };
    case 'stop':
      if (state.status !== 'starting' && state.status !== 'speaking') return state;
      return { ...state, status: 'idle' };
    default:
      return state;
  }
}

/** True while the Listen button should show "Stop". */
export function isNarrating(state: NarrationState): boolean {
  return state.status === 'starting' || state.status === 'speaking';
}

/**
 * Splits a chapter into pieces the speech engine accepts (Android limits one
 * utterance to `maxLength` characters), breaking at sentence ends, then at
 * spaces. Empty input gives no pieces.
 */
export function splitForSpeech(text: string, maxLength = 3900): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  if (clean.length <= maxLength) return [clean];

  const sentences = clean.match(/[^.!?]+[.!?]+["”’)]*\s*|[^.!?]+$/g) ?? [clean];
  const pieces: string[] = [];
  let current = '';
  const flush = () => {
    if (current.trim()) pieces.push(current.trim());
    current = '';
  };
  for (const sentence of sentences) {
    if ((current + sentence).length <= maxLength) {
      current += sentence;
      continue;
    }
    flush();
    if (sentence.length <= maxLength) {
      current = sentence;
      continue;
    }
    // A single very long sentence: cut it at spaces.
    let rest = sentence.trim();
    while (rest.length > maxLength) {
      const cut = rest.lastIndexOf(' ', maxLength);
      const at = cut > 0 ? cut : maxLength;
      pieces.push(rest.slice(0, at).trim());
      rest = rest.slice(at).trim();
    }
    current = rest;
  }
  flush();
  return pieces;
}

/**
 * The best language tag for reading English content: Philippine English if
 * the device has it, then US English, then any English voice. Returns `null`
 * when no English voice exists (the button then hides).
 */
export function pickSpeechLanguage(voices: readonly { language: string }[]): string | null {
  const tags = voices.map((voice) => voice.language.replace('_', '-'));
  const has = (wanted: string) => tags.find((tag) => tag.toLowerCase() === wanted.toLowerCase());
  return has('en-PH') ?? has('en-US') ?? tags.find((tag) => /^en(-|$)/i.test(tag)) ?? null;
}
