import { StyleSheet, View } from 'react-native';
import type { KeyboardTypeOptions, TextInputProps } from 'react-native';
import { HelperText, TextInput } from 'react-native-paper';

import { colors, layout, maxFontScale, radius, typography } from '@/theme';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  /** Guidance shown under the field when there is no error. */
  helper?: string;
  required?: boolean;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  disabled?: boolean;
  onFocus?: () => void;
};

/** Outlined text input with a floating label and an inline error message. */
export function FormTextField({
  label,
  value,
  onChangeText,
  error,
  helper,
  required = false,
  multiline = false,
  maxLength,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
  disabled = false,
  onFocus,
}: Props) {
  const message = error ?? helper;

  return (
    <View>
      <TextInput
        mode="outlined"
        label={required ? `${label} *` : label}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        error={Boolean(error)}
        disabled={disabled}
        multiline={multiline}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxFontSizeMultiplier={maxFontScale}
        outlineColor={colors.outlineStrong}
        activeOutlineColor={colors.primary}
        textColor={colors.ink}
        outlineStyle={styles.outline}
        contentStyle={styles.content}
        style={[styles.input, multiline && styles.multiline]}
      />
      {message ? (
        <HelperText type={error ? 'error' : 'info'} visible padding="none" style={styles.helper}>
          {message}
        </HelperText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
  },
  content: {
    ...typography.input,
  },
  multiline: {
    minHeight: layout.textAreaMinHeight,
  },
  outline: {
    borderRadius: radius.md,
  },
  helper: {
    ...typography.caption,
  },
});
