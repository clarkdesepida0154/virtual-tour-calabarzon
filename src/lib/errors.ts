/**
 * One error type for the whole app, so screens can show a friendly message
 * and pick the right illustration without knowing about Supabase.
 */
export type AppErrorKind = 'network' | 'not-found' | 'config' | 'auth' | 'unknown';

export class AppError extends Error {
  readonly kind: AppErrorKind;
  /** Short heading for error states, e.g. "You're offline". */
  readonly title: string;

  constructor(kind: AppErrorKind, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'AppError';
    this.kind = kind;
    this.title = TITLES[kind];
  }
}

const TITLES: Record<AppErrorKind, string> = {
  network: 'No connection',
  'not-found': 'Not found',
  config: 'Setup needed',
  auth: 'Couldn’t continue',
  unknown: 'Something went wrong',
};

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
 * Wraps anything thrown by the data layer. `context` is the plain-language
 * description of what failed, e.g. "We couldn't load the destinations."
 */
export function toAppError(error: unknown, context: string): AppError {
  if (error instanceof AppError) return error;

  const detail = readMessage(error);
  if (NETWORK_PATTERN.test(detail)) {
    return new AppError(
      'network',
      `${context} Check your internet connection and try again.`,
      { cause: error },
    );
  }
  return new AppError('unknown', `${context} Please try again.`, { cause: error });
}
