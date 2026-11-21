/**
 * Sign-in / sign-up form validation and friendly auth error messages.
 * Pure — no React Native imports — so it can be tested in Node.
 *
 * Messages are i18n keys (see src/i18n/en.ts → `auth.errors`); screens show
 * them with `t(key, AUTH_MESSAGE_PARAMS)`.
 */
import type { TranslationKey } from '@/i18n';

export const PASSWORD_MIN_LENGTH = 8;

/** Placeholder values used by the auth messages (`{{min}}`). */
export const AUTH_MESSAGE_PARAMS = { min: PASSWORD_MIN_LENGTH } as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type AuthFormValues = {
  email: string;
  password: string;
  /** Sign-up only. */
  confirmPassword?: string;
};

export type AuthFormErrors = Partial<Record<keyof AuthFormValues, TranslationKey>>;

export function validateEmail(email: string): TranslationKey | undefined {
  const trimmed = email.trim();
  if (!trimmed) return 'auth.errors.emailRequired';
  if (!EMAIL_PATTERN.test(trimmed)) return 'auth.errors.emailInvalid';
  return undefined;
}

export function validateSignIn(values: AuthFormValues): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'auth.errors.passwordRequired';
  return errors;
}

export function validateSignUp(values: AuthFormValues): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'auth.errors.passwordChoose';
  else if (values.password.length < PASSWORD_MIN_LENGTH) errors.password = 'auth.errors.passwordShort';
  if (!values.confirmPassword) errors.confirmPassword = 'auth.errors.confirmRequired';
  else if (values.password && values.confirmPassword !== values.password) {
    errors.confirmPassword = 'auth.errors.confirmMismatch';
  }
  return errors;
}

export function hasErrors(errors: AuthFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * Maps a Supabase Auth error (code or message) to a plain-language message
 * key, or `null` when the error is not one we recognise.
 */
export function friendlyAuthMessage(error: unknown): TranslationKey | null {
  const code = readField(error, 'code');
  const message = readField(error, 'message').toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'auth.errors.invalidCredentials';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'auth.errors.emailNotConfirmed';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
    return 'auth.errors.userExists';
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return 'auth.errors.weakPassword';
  }
  if (code === 'email_address_invalid' || (message.includes('email address') && message.includes('invalid'))) {
    return 'auth.errors.emailUnusable';
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || message.includes('rate limit')) {
    return 'auth.errors.rateLimited';
  }
  if (code === 'signup_disabled' || message.includes('signups not allowed')) {
    return 'auth.errors.signupDisabled';
  }
  if (/network|fetch failed|failed to fetch|timed? ?out/.test(message)) {
    return 'auth.errors.network';
  }
  return null;
}

function readField(error: unknown, field: 'code' | 'message'): string {
  if (error && typeof error === 'object' && field in error) {
    const value = (error as Record<string, unknown>)[field];
    if (typeof value === 'string') return value;
  }
  return '';
}
