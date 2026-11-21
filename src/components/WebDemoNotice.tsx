import { Platform, View } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { useI18n } from '@/context/I18nContext';
import { radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';

const useStyles = makeStyles(({ colors }) => ({
  box: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  text: { flex: 1, gap: spacing.xs },
}));

/** Small note about the browser build's known limits. Renders on web only. */
export function WebDemoNotice() {
  const { t } = useI18n();
  const styles = useStyles();
  if (Platform.OS !== 'web') return null;
  return (
    <View style={styles.box} accessibilityRole="summary">
      <AppIcon name="web" size="md" color="primary" />
      <View style={styles.text}>
        <AppText variant="label">{t('settings.about.webDemoTitle')}</AppText>
        <AppText variant="body" color="inkSoft">
          {t('settings.about.webDemoBody')}
        </AppText>
      </View>
    </View>
  );
}
