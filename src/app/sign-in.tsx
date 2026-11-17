import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { AuthLayout, AuthTextField, FormBanner } from '@/components/auth/AuthParts';
import { useIdentity } from '@/context/IdentityContext';
import { hasErrors, validateSignIn } from '@/lib/authForm';
import type { AuthFormValues } from '@/lib/authForm';
import { toAppError } from '@/lib/errors';
import { layout, spacing } from '@/theme';

type Field = 'email' | 'password';

export default function SignInScreen() {
  const router = useRouter();
  const identity = useIdentity();
  const [values, setValues] = useState<AuthFormValues>({ email: '', password: '' });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);

  const errors = validateSignIn(values);
  const errorFor = (field: Field) => (touched[field] || submitted ? errors[field] : undefined);

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Navigate only once the root stack has re-rendered with the new session.
  useEffect(() => {
    if (succeeded && identity.kind === 'user') leave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [succeeded, identity.kind]);

  const update = (field: Field) => (text: string) => {
    setValues((current) => ({ ...current, [field]: text }));
    setFormError(null);
  };

  const submit = async () => {
    setSubmitted(true);
    if (hasErrors(errors) || busy) return;
    setBusy(true);
    setFormError(null);
    try {
      await identity.signIn(values.email, values.password);
      setSucceeded(true);
    } catch (cause) {
      setFormError(toAppError(cause, 'We couldn’t sign you in.').message);
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      overline="Welcome back"
      title="Sign In"
      subtitle="Pick up your tours and quiz scores where you left them."
      onBack={leave}>
      {formError ? <FormBanner message={formError} /> : null}

      <AuthTextField
        kind="email"
        label="Email"
        value={values.email}
        onChangeText={update('email')}
        onBlur={() => setTouched((current) => ({ ...current, email: true }))}
        error={errorFor('email')}
        disabled={busy}
        returnKeyType="next"
      />
      <AuthTextField
        kind="password"
        label="Password"
        value={values.password}
        onChangeText={update('password')}
        onBlur={() => setTouched((current) => ({ ...current, password: true }))}
        error={errorFor('password')}
        disabled={busy}
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <AppButton label="Sign in" icon="login" onPress={submit} loading={busy} style={styles.submit} />

      <View style={styles.switch}>
        <AppText variant="body" color="inkSoft">
          New here?
        </AppText>
        <Pressable
          onPress={() => router.replace('/sign-up')}
          accessibilityRole="link"
          hitSlop={spacing.md}
          style={({ pressed }) => pressed && styles.pressed}>
          <AppText variant="bodyStrong" color="primary">
            Create an account
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
});
