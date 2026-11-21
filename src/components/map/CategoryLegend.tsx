import { Pressable, ScrollView, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { CATEGORIES, CATEGORY_META } from '@/constants/taxonomy';
import type { Category } from '@/constants/taxonomy';
import { useI18n } from '@/context/I18nContext';
import { layout, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';

type Props = {
  /** The category being shown alone, or null for all. */
  selected: Category | null;
  onChange: (category: Category | null) => void;
  counts: Partial<Record<Category, number>>;
};

/**
 * The map legend, doubling as a filter, in the app's chip style: each chip
 * carries the category's pin colour and how many pins it has; tapping one
 * shows only that category (tap again for all). Scrolls sideways.
 */
export function CategoryLegend({ selected, onChange, counts }: Props) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, categoryLabel } = useI18n();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel={t('map.legendA11y')}>
      {CATEGORIES.map((category) => {
        const isOn = selected === category;
        const isDimmed = selected !== null && !isOn;
        const meta = CATEGORY_META[category];
        const count = counts[category] ?? 0;
        return (
          <Pressable
            key={category}
            onPress={() => onChange(isOn ? null : category)}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn }}
            accessibilityLabel={t('map.legendChipA11y', { label: categoryLabel(category), count })}
            accessibilityHint={t(isOn ? 'map.legendShowAll' : 'map.legendShowOnly')}
            android_ripple={{ color: colors.pressed }}
            style={({ pressed }) => [
              styles.chip,
              isOn && styles.chipOn,
              isDimmed && styles.chipDimmed,
              pressed && styles.pressed,
            ]}>
            {isOn ? (
              <AppIcon name="check" size="xs" color="onPrimary" />
            ) : (
              <View style={[styles.swatch, { backgroundColor: colors[meta.color] }]}>
                <AppIcon name={meta.icon} size="xs" color="pinRim" />
              </View>
            )}
            <AppText variant="label" color={isOn ? 'onPrimary' : 'ink'} numberOfLines={1}>
              {categoryLabel(category, 'short')}
            </AppText>
            <View style={[styles.count, isOn && styles.countOn]}>
              <AppText variant="caption" color={isOn ? 'primary' : 'inkSoft'}>
                {count}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.chipHeight,
    paddingLeft: spacing.sm,
    paddingRight: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.outlineStrong,
  },
  chipOn: {
    paddingLeft: spacing.md,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipDimmed: {
    opacity: 0.72,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  swatch: {
    width: layout.legendSwatch,
    height: layout.legendSwatch,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    minWidth: layout.legendSwatch,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  countOn: {
    backgroundColor: colors.onPrimary,
  },
}));
