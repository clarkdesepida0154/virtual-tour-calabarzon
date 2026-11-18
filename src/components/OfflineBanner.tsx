import { Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { useDataSync } from '@/context/DataSyncContext';
import { useShowingSavedData } from '@/lib/appCache';
import { colors, layout, radius, spacing } from '@/theme';

/**
 * A quiet strip shown while the screens are serving the saved catalogue
 * because the phone is offline. "Retry" asks every screen to reload; the
 * first successful network read hides the strip again.
 */
export function OfflineBanner({ style }: { style?: StyleProp<ViewStyle> }) {
  const showing = useShowingSavedData();
  const { notifyChanged } = useDataSync();
  if (!showing) return null;

  return (
    <View
      style={[styles.banner, style]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel="Offline. Showing saved data.">
      <AppIcon name="cloud-off-outline" size="sm" color="inkSoft" />
      <AppText variant="label" color="inkSoft" style={styles.text}>
        Offline — showing saved data
      </AppText>
      <Pressable
        onPress={notifyChanged}
        hitSlop={spacing.md}
        accessibilityRole="button"
        accessibilityLabel="Try to reconnect"
        style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
        <AppText variant="label" color="primary">
          Retry
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: layout.hairline,
    borderColor: colors.outline,
  },
  text: {
    flex: 1,
  },
  retry: {
    paddingHorizontal: spacing.xs,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
});
