import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { AuthLayout, AuthTextField, FormBanner } from '@/components/auth/AuthParts';
import { useIdentity } from '@/context/IdentityContext';
import { PASSWORD_MIN_LENGTH, hasErrors, validateSignUp } from '@/lib/authForm';
import type { AuthFormValues } from '@/lib/authForm';
import { toAppError } from '@/lib/errors';
import { colors, layout, radius, spacing } from '@/theme';

type Field = 'email' | 'password' | 'confirmPassword';

export default function SignUpScreen() {
  const router = useRouter();
  const identity = useIdentity();
  const [values, setValues] = useState<AuthFormValues>({ email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [enteredAsGuest, setEnteredAsGuest] = useState(false);
  /** Set when Supabase requires the email to be confirmed before the first sign-in. */
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const errors = validateSignUp(values);
  const errorFor = (field: Field) => (touched[field] || submitted ? errors[field] : undefined);
  const wasGuest = identity.kind === 'guest' && !identity.needsWelcome;

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Navigate only once the root stack has re-rendered with the new session.
  useEffect(() => {
    if ((succeeded && identity.kind === 'user') || (enteredAsGuest && !identity.needsWelcome)) leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded, enteredAsGuest, identity.kind, identity.needsWelcome]);

  const update = (field: Field) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setFormError(null);
  };
  const touch = (field: Field) => () => setTouched((current) => ({ ...current, [field]: true }));

  const submit = async () => {
    setSubmitted(true);
    if (hasErrors(errors) || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      const result = await identity.signUp(values.email, values.password);
      if (result.status === 'signed-in') {
        setSucceeded(true);
      } else {
        setConfirmEmail(result.email);
        setBusy(false);
      }
    } catch (cause) {
      setFormError(toAppError(cause, 'We couldn’t create your account.').message);
      setBusy(false);
    }
  };

  if (confirmEmail) {
    return (
      <AuthLayout
        overline="Almost there"
        title="Check your inbox"
        subtitle="One last step before your first sign-in."
        onBack={leave}>
        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <AppIcon name="email-check-outline" size="xl" color="success" />
          </View>
          <AppText variant="bodyLarge" align="center">
            We sent a confirmation link to{'\n'}
            <AppText variant="bodyStrong">{confirmEmail}</AppText>
          </AppText>
          <AppText variant="body" color="inkSoft" align="center">
            Open it on this phone, then come back and sign in. Can’t find it? Look in your spam
            folder.
          </AppText>
        </View>
        <AppButton label="Go to sign in" icon="login" onPress={() => router.replace('/sign-in')} />
        {identity.needsWelcome ? (
          <AppButton
            label="Continue as guest for now"
            variant="text"
            icon="arrow-right"
            onPress={() => {
              void identity.continueAsGuest().then(() => setEnteredAsGuest(true));
            }}
          />
        ) : null}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      overline="Join the tour"
      title="Create an Account"
      subtitle={
        wasGuest
          ? 'Your guest progress comes with you to the new account.'
          : 'Save your visited destinations and quiz scores to your email.'
      }
      onBack={leave}>
      {formError ? <FormBanner message={formError} /> : null}

      <AuthTextField
        kind="email"
        label="Email"
        value={values.email}
        onChangeText={update('email')}
        onBlur={touch('email')}
        error={errorFor('email')}
        disabled={busy}
        returnKeyType="next"
      />
      <AuthTextField
        kind="new-password"
        label="Password"
        value={values.password}
        onChangeText={update('password')}
        onBlur={touch('password')}
        error={errorFor('password')}
        helper={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        disabled={busy}
        returnKeyType="next"
      />
      <AuthTextField
        kind="new-password"
        label="Confirm password"
        value={values.confirmPassword ?? ''}
        onChangeText={update('confirmPassword')}
        onBlur={touch('confirmPassword')}
        error={errorFor('confirmPassword')}
        disabled={busy}
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <AppButton
        label="Create account"
        icon="account-plus-outline"
        onPress={submit}
        loading={busy}
        style={styles.submit}
      />

      <View style={styles.switch}>
        <AppText variant="body" color="inkSoft">
          Already have an account?
        </AppText>
        <Pressable
          onPress={() => router.replace('/sign-in')}
          accessibilityRole="link"
          hitSlop={spacing.md}
          style={({ pressed }) => pressed && styles.pressed}>
          <AppText variant="bodyStrong" color="primary">
            Sign in
          </AppText>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({
  submit: {
    marginTop: spacing.sm,
  },
  switch: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  notice: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.outline,
  },
  noticeIcon: {
    width: layout.emblem,
    height: layout.emblem,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
