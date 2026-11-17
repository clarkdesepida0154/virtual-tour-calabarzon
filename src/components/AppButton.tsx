import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Button } from 'react-native-paper';

import type { IconName } from '@/components/AppIcon';
import { colors, layout, radius, typography } from '@/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
};

const MODES = {
  primary: 'contained',
  secondary: 'outlined',
  danger: 'outlined',
  text: 'text',
} as const;

/** The app's button: one shape and type style, four intents. */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
  accessibilityHint,
}: Props) {
  const isDanger = variant === 'danger';

  return (
    <Button
      mode={MODES[variant]}
      icon={icon}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      accessibilityHint={accessibilityHint}
      textColor={isDanger ? colors.error : undefined}
      style={[styles.button, isDanger && !disabled && styles.danger, style]}
      contentStyle={styles.content}
      labelStyle={styles.label}>
      {label}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.pill,
  },
  danger: {
    borderColor: colors.error,
  },
  content: {
    minHeight: layout.touchTarget,
  },
  label: {
    ...typography.button,
  },
});
