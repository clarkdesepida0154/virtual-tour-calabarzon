import { StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Searchbar } from 'react-native-paper';

import { colors, elevation, layout, maxFontScale, radius, typography } from '@/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Called when the keyboard's search key is pressed. */
  onSubmit?: () => void;
  /** `raised` floats over the Home hero; `flat` sits on the page with an outline. */
  tone?: 'raised' | 'flat';
  style?: StyleProp<ViewStyle>;
};

/** The pill-shaped search box used on Home and Explore. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  onSubmit,
  tone = 'flat',
  style,
}: Props) {
  return (
    <Searchbar
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      placeholder={placeholder}
      placeholderTextColor={colors.muted}
      iconColor={colors.primary}
      returnKeyType="search"
      autoCorrect={false}
      autoCapitalize="none"
      elevation={0}
      maxFontSizeMultiplier={maxFontScale}
      inputStyle={styles.input}
      style={[styles.bar, tone === 'raised' ? styles.raised : styles.flat, style]}
      accessibilityLabel={placeholder}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    height: layout.searchBarHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  raised: {
    ...elevation.raised,
  },
  flat: {
    borderWidth: layout.hairline,
    borderColor: colors.outlineStrong,
  },
  input: {
    ...typography.input,
    color: colors.ink,
    minHeight: layout.searchBarHeight,
  },
});
