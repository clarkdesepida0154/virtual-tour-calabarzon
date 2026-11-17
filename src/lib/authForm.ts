/**
 * Sign-in / sign-up form validation and friendly auth error messages.
 * Pure — no React Native imports — so it can be tested in Node.
 */
export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type AuthFormValues = {
  email: string;
  password: string;
  /** Sign-up only. */
  confirmPassword?: string;
};

export type AuthFormErrors = Partial<Record<keyof AuthFormValues, string>>;

export function validateEmail(email: string): string | undefined {
  const trimmed = email.trim();
  if (!trimmed) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(trimmed)) return 'That doesn’t look like an email address.';
  return undefined;
}

export function validateSignIn(values: AuthFormValues): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'Enter your password.';
  return errors;
}

export function validateSignUp(values: AuthFormValues): AuthFormErrors {
  const errors: AuthFormErrors = {};
  const email = validateEmail(values.email);
  if (email) errors.email = email;
  if (!values.password) errors.password = 'Choose a password.';
  else if (values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (!values.confirmPassword) errors.confirmPassword = 'Type the password again.';
  else if (values.password && values.confirmPassword !== values.password) {
    errors.confirmPassword = 'The two passwords don’t match.';
  }
  return errors;
}

export function hasErrors(errors: AuthFormErrors): boolean {
  return Object.values(errors).some(Boolean);
}

/**
 * Maps a Supabase Auth error (code or message) to plain language.
 * Unknown errors fall back to `fallback`.
 */
export function friendlyAuthMessage(error: unknown, fallback: string): string {
  const code = readField(error, 'code');
  const message = readField(error, 'message').toLowerCase();

  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return 'That email and password don’t match an account. Check them and try again.';
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return 'Please confirm your email first — open the link we sent to your inbox, then sign in.';
  }
  if (code === 'user_already_exists' || code === 'email_exists' || message.includes('already registered')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (code === 'weak_password' || message.includes('password should')) {
    return `That password is too weak. Use at least ${PASSWORD_MIN_LENGTH} characters, mixing letters and numbers.`;
  }
  if (code === 'email_address_invalid' || message.includes('email address') && message.includes('invalid')) {
    return 'That email address can’t be used. Please check it, or use a different one.';
  }
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || message.includes('rate limit')) {
    return 'Too many attempts in a short time. Please wait a few minutes and try again.';
  }
  if (code === 'signup_disabled' || message.includes('signups not allowed')) {
    return 'New accounts can’t be created right now. You can still continue as a guest.';
  }
  if (/network|fetch failed|failed to fetch|timed? ?out/.test(message)) {
    return 'We couldn’t reach the server. Check your internet connection and try again.';
  }
  return fallback;
}

function readField(error: unknown, field: 'code' | 'message'): string {
  if (error && typeof error === 'object' && field in error) {
    const value = (error as Record<string, unknown>)[field];
    if (typeof value === 'string') return value;
  }
  return '';
}
