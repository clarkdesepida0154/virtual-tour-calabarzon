import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIconButton } from '@/components/AppIconButton';
import { AppText } from '@/components/AppText';
import { iconSize, layout, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

type Props = {
  title: string;
  /** Small gold line above the title. */
  overline?: string;
  subtitle?: string;
  /** Shows a back arrow when provided. */
  onBack?: () => void;
  /** Draws a hairline under the header; use when content scrolls beneath it. */
  divider?: boolean;
  /** Shown at the top right, level with the title (e.g. a Settings button). */
  action?: ReactNode;
};

/** Page title block that also clears the status bar / notch. */
export function ScreenHeader({ title, overline, subtitle, onBack, divider = false, action }: Props) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t } = useI18n();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.container, divider && styles.divider, { paddingTop: insets.top + spacing.md }]}>
      {onBack ? (
        <AppIconButton
          icon="arrow-left"
          size={iconSize.md}
          iconColor={colors.ink}
          onPress={onBack}
          accessibilityLabel={t('common.goBack')}
          style={styles.back}
        />
      ) : null}
      <View style={styles.titleRow}>
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
      {action ? <View style={styles.action}>{action}</View> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  titles: {
    flex: 1,
    gap: spacing.xs,
  },
  action: {
    marginRight: -spacing.sm,
  },
}));
