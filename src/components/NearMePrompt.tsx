import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { useUserLocation } from '@/context/LocationContext';
import { colors, elevation, layout, radius, spacing } from '@/theme';

/**
 * The polite way in to "Near me": explains what location is used for before
 * the system dialog appears. Only shown while permission has never been
 * asked and the person has not tapped "Not now".
 */
export function NearMePrompt() {
  const location = useUserLocation();
  if (location.status !== 'undetermined' || location.promptDismissed) return null;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <AppIcon name="crosshairs-gps" size="sm" color="secondaryDark" />
        </View>
        <View style={styles.flex}>
          <AppText variant="subtitle">See what is near you</AppText>
          <AppText variant="caption" color="inkSoft">
            Show how far each destination is and sort them nearest first. Your location stays on
            this phone.
          </AppText>
        </View>
      </View>
      <View style={styles.actions}>
        <AppButton
          label="Allow location"
          icon="crosshairs-gps"
          variant="secondary"
          onPress={() => void location.requestPermission()}
          style={styles.flex}
        />
        <AppButton label="Not now" variant="text" onPress={location.dismissPrompt} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
