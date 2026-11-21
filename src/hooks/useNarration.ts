import * as Speech from 'expo-speech';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { AppState } from 'react-native';

import { usePreferences } from '@/context/PreferencesContext';
import { tapFeedback } from '@/lib/device';
import { INITIAL_NARRATION, isNarrating, narrationReducer, pickSpeechLanguage, splitForSpeech } from '@/lib/narration';
import { SPEECH_RATE_VALUES } from '@/lib/preferences';

/** Voices can load a moment after start-up on some Android engines: ask twice. */
const VOICE_RETRY_MS = 700;

export type Narration = {
  /** False when narration is switched off in Settings or the device has no English voice. */
  isAvailable: boolean;
  isNarrating: boolean;
  /** Play / stop. */
  toggle: () => void;
  stop: () => void;
};

/**
 * Reads `text` aloud with the device's text-to-speech (expo-speech), using
 * the speed chosen in Settings. Stops by itself when the component unmounts
 * (leaving the tour step, closing the tour) and when the app goes to the
 * background.
 */
export function useNarration(text: string | null | undefined): Narration {
  const { preferences } = usePreferences();
  const [state, dispatch] = useReducer(narrationReducer, INITIAL_NARRATION);
  const language = useRef<string | null>(null);
  const speaking = isNarrating(state);

  // Which voice to use, once.
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async (retry: boolean) => {
      let voices: Speech.Voice[] = [];
      try {
        voices = await Speech.getAvailableVoicesAsync();
      } catch {
        voices = [];
      }
      if (!active) return;
      const chosen = pickSpeechLanguage(voices);
      if (!chosen && retry) {
        timer = setTimeout(() => void check(false), VOICE_RETRY_MS);
        return;
      }
      language.current = chosen;
      dispatch({ type: 'voices', available: chosen !== null });
    };
    void check(true);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const stop = useCallback(() => {
    dispatch({ type: 'stop' });
    Speech.stop().catch(() => {});
  }, []);

  // Always silence the engine when the reader goes away or the text changes.
  useEffect(() => () => void Speech.stop().catch(() => {}), [text]);

  // Backgrounding the app stops the narration.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') stop();
    });
    return () => subscription.remove();
  }, [stop]);

  // Start speaking when the machine enters `starting`.
  useEffect(() => {
    if (state.status !== 'starting') return;
    const utterance = state.utterance;
    const pieces = splitForSpeech(text ?? '', Speech.maxSpeechInputLength || 3900);
    if (pieces.length === 0) {
      dispatch({ type: 'done', utterance });
      return;
    }
    void Speech.stop()
      .catch(() => {})
      .then(() => {
        pieces.forEach((piece, index) => {
          Speech.speak(piece, {
            language: language.current ?? 'en-US',
            rate: SPEECH_RATE_VALUES[preferences.speechRate],
            onStart: index === 0 ? () => dispatch({ type: 'started', utterance }) : undefined,
            onDone: index === pieces.length - 1 ? () => dispatch({ type: 'done', utterance }) : undefined,
            onStopped: () => dispatch({ type: 'done', utterance }),
            onError: () => dispatch({ type: 'error', utterance }),
          });
        });
      });
  }, [state, text, preferences.speechRate]);

  const toggle = useCallback(() => {
    tapFeedback();
    if (speaking) stop();
    else dispatch({ type: 'play' });
  }, [speaking, stop]);

  return {
    isAvailable: preferences.narration && state.status !== 'checking' && state.status !== 'unavailable',
    isNarrating: speaking,
    toggle,
    stop,
  };
}
