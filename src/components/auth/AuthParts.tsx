import { useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, layout, maxFontScale, radius, spacing, typography } from '@/theme';

type LayoutProps = {
  overline: string;
  title: string;
  subtitle: string;
  onBack: () => void;
  children: ReactNode;
};

/** Shared frame of the Sign In and Sign Up screens: header, keyboard-safe scroll. */
export function AuthLayout({ overline, title, subtitle, onBack, children }: LayoutProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <ScreenHeader overline={overline} title={title} subtitle={subtitle} onBack={onBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' || Platform.OS === 'android' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xxl }]}>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  error?: string;
  helper?: string;
  kind: 'email' | 'password' | 'new-password';
  disabled?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
};

/** Email / password input with the right keyboard, autofill hints and a show-password toggle. */
export function AuthTextField({
  label,
  value,
  onChangeText,
  onBlur,
  error,
  helper,
  kind,
  disabled = false,
  returnKeyType,
  onSubmitEditing,
}: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = kind !== 'email';
  const message = error ?? helper;

  return (
    <View>
      <TextInput
        mode="outlined"
        label={label}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        error={Boolean(error)}
        disabled={disabled}
        secureTextEntry={isPassword && !revealed}
        keyboardType={isPassword ? 'default' : 'email-address'}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={kind === 'email' ? 'email' : kind === 'password' ? 'current-password' : 'new-password'}
        textContentType={kind === 'email' ? 'emailAddress' : kind === 'password' ? 'password' : 'newPassword'}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        maxFontSizeMultiplier={maxFontScale}
        outlineColor={colors.outlineStrong}
        activeOutlineColor={colors.primary}
        textColor={colors.ink}
        outlineStyle={styles.outline}
        contentStyle={styles.input}
        style={styles.field}
        left={<TextInput.Icon icon={isPassword ? 'lock-outline' : 'email-outline'} color={colors.muted} />}
        right={
          isPassword ? (
            <TextInput.Icon
              icon={revealed ? 'eye-off-outline' : 'eye-outline'}
              color={colors.inkSoft}
              onPress={() => setRevealed((current) => !current)}
              accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            />
          ) : undefined
        }
      />
      {message ? (
        <HelperText type={error ? 'error' : 'info'} visible padding="none" style={styles.helper}>
          {message}
        </HelperText>
      ) : null}
    </View>
  );
}

/** A form-level message: the server's answer, in plain words. */
export function FormBanner({ message, tone = 'error' }: { message: string; tone?: 'error' | 'info' }) {
  const isError = tone === 'error';
  return (
    <View
      style={[styles.banner, isError ? styles.bannerError : styles.bannerInfo]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <AppIcon
        name={isError ? 'alert-circle-outline' : 'information-outline'}
        size="sm"
        color={isError ? 'error' : 'success'}
      />
      <AppText variant="body" color={isError ? 'error' : 'success'} style={styles.flex}>
        {message}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  field: {
    backgroundColor: colors.surface,
  },
  input: {
    ...typography.input,
  },
  outline: {
    borderRadius: radius.md,
  },
  helper: {
    ...typography.caption,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  bannerError: {
    backgroundColor: colors.errorSoft,
  },
  bannerInfo: {
    backgroundColor: colors.successSoft,
  },
});
