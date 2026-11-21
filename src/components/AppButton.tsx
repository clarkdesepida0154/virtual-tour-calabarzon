import type { StyleProp, ViewStyle } from 'react-native';
import { Button } from 'react-native-paper';

import type { IconName } from '@/components/AppIcon';
import { layout, radius, typography } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

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
  /** Overrides the spoken name (defaults to the label). */
  accessibilityLabel?: string;
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
  accessibilityLabel,
}: Props) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const isDanger = variant === 'danger';

  return (
    <Button
      mode={MODES[variant]}
      icon={icon}
      onPress={onPress}
      loading={loading}
      disabled={disabled || loading}
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      textColor={isDanger ? colors.error : undefined}
      style={[styles.button, isDanger && !disabled && styles.danger, style]}
      contentStyle={styles.content}
      labelStyle={styles.label}>
      {label}
    </Button>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
}));
