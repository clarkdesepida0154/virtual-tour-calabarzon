/**
 * The person's app settings (Settings screen), stored as one JSON value on
 * the device. Pure — parsing is tolerant, so a missing, old or corrupt value
 * simply falls back to the defaults.
 */
export type ThemePreference = 'system' | 'light' | 'dark';
export type Locale = 'en' | 'fil';
export type SpeechRate = 'normal' | 'slow';

export type Preferences = {
  theme: ThemePreference;
  locale: Locale;
  /** Show the "Listen" button in the virtual tour. */
  narration: boolean;
  speechRate: SpeechRate;
};

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];
export const LOCALES: readonly Locale[] = ['en', 'fil'];
export const SPEECH_RATE_OPTIONS: readonly SpeechRate[] = ['normal', 'slow'];

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'system',
  locale: 'en',
  narration: true,
  speechRate: 'normal',
};

/** expo-speech `rate` for each setting (1 = the voice's normal pace). */
export const SPEECH_RATE_VALUES: Record<SpeechRate, number> = { normal: 1, slow: 0.8 };

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** Reads a stored value; anything unknown or malformed falls back to the default. */
export function parsePreferences(raw: string | null | undefined): Preferences {
  if (!raw) return { ...DEFAULT_PREFERENCES };
  let data: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { ...DEFAULT_PREFERENCES };
    data = parsed as Record<string, unknown>;
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
  return {
    theme: pick(data.theme, THEME_PREFERENCES, DEFAULT_PREFERENCES.theme),
    locale: pick(data.locale, LOCALES, DEFAULT_PREFERENCES.locale),
    narration: typeof data.narration === 'boolean' ? data.narration : DEFAULT_PREFERENCES.narration,
    speechRate: pick(data.speechRate, SPEECH_RATE_OPTIONS, DEFAULT_PREFERENCES.speechRate),
  };
}

/** The colour scheme to draw: an explicit choice wins; "system" follows the phone (light if unknown). */
export function resolveScheme(
  preference: ThemePreference,
  system: string | null | undefined,
): 'light' | 'dark' {
  if (preference === 'light' || preference === 'dark') return preference;
  return system === 'dark' ? 'dark' : 'light';
}
