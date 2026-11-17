import { Text } from 'react-native';
import type { TextProps } from 'react-native';

import { colors, maxFontScale, typography } from '@/theme';
import type { ColorToken, TypographyToken } from '@/theme';

type Props = TextProps & {
  variant?: TypographyToken;
  color?: ColorToken;
  align?: 'left' | 'center' | 'right';
};

/**
 * The only way screens render text: pick a type style and a colour by name.
 * Keeps font families, sizes and colours out of screen code.
 */
export function AppText({ variant = 'body', color = 'ink', align, style, ...rest }: Props) {
  return (
    <Text
      maxFontSizeMultiplier={maxFontScale}
      {...rest}
      style={[typography[variant], { color: colors[color] }, align && { textAlign: align }, style]}
    />
  );
}
