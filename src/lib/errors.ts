/**
 * One error type for the whole app, so screens can show a friendly message
 * and pick the right illustration without knowing about Supabase.
 *
 * Errors carry an i18n key (`contextKey`), not a sentence: the screens show
 * it in the current language (`useI18n().errorMessage(error)`). `message`
 * holds the English text, for logs and the Node test scripts.
 */
import { en } from '@/i18n/en';
import { tEnglish } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import type { TranslateParams } from '@/i18n/translate';

export type AppErrorKind = 'network' | 'not-found' | 'config' | 'auth' | 'unknown';

/** What was being attempted — a key of `errors.context` in the dictionaries. */
export type ErrorContext = keyof typeof en.errors.context;

export class AppError extends Error {
  readonly kind: AppErrorKind;
  /** Short English heading, e.g. "No connection" (screens use `errorTitle`). */
  readonly title: string;
  /** i18n key of the message body. */
  readonly contextKey: TranslationKey;
  readonly params: TranslateParams | undefined;

  constructor(
    kind: AppErrorKind,
    messageKey: TranslationKey,
    options?: { cause?: unknown; params?: TranslateParams },
  ) {
    const body = tEnglish(messageKey, options?.params);
    const suffix = tEnglish(`errors.suffix.${kind}`);
    super(suffix ? `${body} ${suffix}` : body, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.kind = kind;
    this.title = tEnglish(`errors.titles.${kind}`);
    this.contextKey = messageKey;
    this.params = options?.params;
  }
}

const NETWORK_PATTERN =
  /network request failed|failed to fetch|fetch failed|network error|timed? ?out|ENOTFOUND|ECONNREFUSED|load failed/i;

function readMessage(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return '';
}

/**
 * Wraps anything thrown by the data layer. `context` names what failed,
 * e.g. 'loadDestinations' → "We couldn't load the destinations."
 */
export function toAppError(error: unknown, context: ErrorContext): AppError {
  if (error instanceof AppError) return error;

  const detail = readMessage(error);
  const key = `errors.context.${context}` as const;
  if (NETWORK_PATTERN.test(detail)) {
    return new AppError('network', key, { cause: error });
  }
  return new AppError('unknown', key, { cause: error });
}
