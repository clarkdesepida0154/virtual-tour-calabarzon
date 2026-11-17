import { StyleSheet, View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/AppText';
import { colors, iconSize, layout, spacing } from '@/theme';

type Props = {
  title: string;
  /** Small gold line above the title. */
  overline?: string;
  subtitle?: string;
  /** Shows a back arrow when provided. */
  onBack?: () => void;
  /** Draws a hairline under the header; use when content scrolls beneath it. */
  divider?: boolean;
};

/** Page title block that also clears the status bar / notch. */
export function ScreenHeader({ title, overline, subtitle, onBack, divider = false }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, divider && styles.divider, { paddingTop: insets.top + spacing.md }]}>
      {onBack ? (
        <IconButton
          icon="arrow-left"
          size={iconSize.md}
          iconColor={colors.ink}
          onPress={onBack}
          accessibilityLabel="Go back"
          style={styles.back}
        />
      ) : null}
      <View style={styles.titles}>
        {overline ? (
          <AppText variant="overline" color="secondaryDark">
            {overline}
          </AppText>
        ) : null}
        <AppText variant="screenTitle" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color="inkSoft">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  divider: {
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.outline,
  },
  back: {
    marginLeft: -spacing.md,
    marginTop: 0,
    marginBottom: spacing.xs,
  },
  titles: {
    gap: spacing.xs,
  },
});
