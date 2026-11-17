import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { colors, layout, radius, spacing } from '@/theme';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

/** Serif section title with a short gold rule, and an optional "See all". */
export function SectionHeader({ title, subtitle, actionLabel, onAction }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.text}>
        <View style={styles.ornament} />
        <AppText variant="sectionTitle" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color="inkSoft">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={spacing.md}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}: ${title}`}
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
          <AppText variant="label" color="primary">
            {actionLabel}
          </AppText>
          <AppIcon name="chevron-right" size="sm" color="primary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  text: {
    flex: 1,
    gap: spacing.xs,
  },
  ornament: {
    width: layout.ornamentWidth,
    height: layout.ornamentHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
    marginBottom: spacing.xs,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.xs,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
});
