import { View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { useUserLocation } from '@/context/LocationContext';
import { layout, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

/**
 * The polite way in to "Near me": explains what location is used for before
 * the system dialog appears. Only shown while permission has never been
 * asked and the person has not tapped "Not now".
 */
export function NearMePrompt() {
  const styles = useStyles();
  const { t } = useI18n();
  const location = useUserLocation();
  if (location.status !== 'undetermined' || location.promptDismissed) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <AppIcon name="crosshairs-gps" size="sm" color="secondaryDark" />
        </View>
        <View style={styles.flex}>
          <AppText variant="subtitle">{t('nearMe.promptTitle')}</AppText>
          <AppText variant="caption" color="inkSoft">
            {t('nearMe.promptBody')}
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <AppButton
          label={t('nearMe.allow')}
          icon="crosshairs-gps"
          variant="secondary"
          onPress={() => void location.requestPermission()}
          style={styles.flex}
        />
        <AppButton label={t('nearMe.notNow')} variant="text" onPress={location.dismissPrompt} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  card: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  icon: {
    width: layout.iconBadge,
    height: layout.iconBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
}));
