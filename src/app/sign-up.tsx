import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { AuthLayout, AuthTextField, FormBanner } from '@/components/auth/AuthParts';
import { useIdentity } from '@/context/IdentityContext';
import { AUTH_MESSAGE_PARAMS, hasErrors, validateSignUp } from '@/lib/authForm';
import type { AuthFormValues } from '@/lib/authForm';
import { toAppError } from '@/lib/errors';
import type { AppError } from '@/lib/errors';
import { layout, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

type Field = 'email' | 'password' | 'confirmPassword';

export default function SignUpScreen() {
  const styles = useStyles();
  const router = useRouter();
  const { t, errorMessage } = useI18n();
  const identity = useIdentity();
  const [values, setValues] = useState<AuthFormValues>({ email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<AppError | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [enteredAsGuest, setEnteredAsGuest] = useState(false);
  /** Set when Supabase requires the email to be confirmed before the first sign-in. */
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);

  const errors = validateSignUp(values);
  const errorFor = (field: Field) => {
    const key = touched[field] || submitted ? errors[field] : undefined;
    return key ? t(key, AUTH_MESSAGE_PARAMS) : undefined;
  };
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
      setFormError(toAppError(cause, 'createAccount'));
      setBusy(false);
    }
  };

  if (confirmEmail) {
    return (
      <AuthLayout
        overline={t('auth.signUp.checkInbox.overline')}
        title={t('auth.signUp.checkInbox.title')}
        subtitle={t('auth.signUp.checkInbox.subtitle')}
        onBack={leave}>
        <View style={styles.notice}>
          <View style={styles.noticeIcon}>
            <AppIcon name="email-check-outline" size="xl" color="success" />
          </View>
          <AppText variant="bodyLarge" align="center">
            {t('auth.signUp.checkInbox.sentTo')}{'\n'}
            <AppText variant="bodyStrong">{confirmEmail}</AppText>
          </AppText>
          <AppText variant="body" color="inkSoft" align="center">
            {t('auth.signUp.checkInbox.instructions')}
          </AppText>
        </View>
        <AppButton label={t('auth.signUp.checkInbox.goToSignIn')} icon="login" onPress={() => router.replace('/sign-in')} />
        {identity.needsWelcome ? (
          <AppButton
            label={t('auth.signUp.checkInbox.continueAsGuest')}
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
      overline={t('auth.signUp.overline')}
      title={t('auth.signUp.title')}
      subtitle={
        wasGuest ? t('auth.signUp.benefitGuest') : t('auth.signUp.benefitProgress')
      }
      onBack={leave}>
      {formError ? <FormBanner message={errorMessage(formError)} /> : null}

      <AuthTextField
        kind="email"
        label={t('auth.email')}
        value={values.email}
        onChangeText={update('email')}
        onBlur={touch('email')}
        error={errorFor('email')}
        disabled={busy}
        returnKeyType="next"
      />
      <AuthTextField
        kind="new-password"
        label={t('auth.password')}
        value={values.password}
        onChangeText={update('password')}
        onBlur={touch('password')}
        error={errorFor('password')}
        helper={t('auth.signUp.passwordHelper', AUTH_MESSAGE_PARAMS)}
        disabled={busy}
        returnKeyType="next"
      />
      <AuthTextField
        kind="new-password"
        label={t('auth.confirmPassword')}
        value={values.confirmPassword ?? ''}
        onChangeText={update('confirmPassword')}
        onBlur={touch('confirmPassword')}
        error={errorFor('confirmPassword')}
        disabled={busy}
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <AppButton
        label={t('auth.signUp.submit')}
        icon="account-plus-outline"
        onPress={submit}
        loading={busy}
        style={styles.submit}
      />

      <View style={styles.switch}>
        <AppText variant="body" color="inkSoft">
          {t('auth.signUp.haveAccount')}
        </AppText>
        <Pressable
          onPress={() => router.replace('/sign-in')}
          accessibilityRole="link"
          hitSlop={spacing.md}
          style={({ pressed }) => pressed && styles.pressed}>
          <AppText variant="bodyStrong" color="primary">
            {t('auth.signUp.signIn')}
          </AppText>
        </Pressable>
      </View>
    </AuthLayout>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
}));
