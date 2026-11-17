import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { CATEGORIES, CATEGORY_META } from '@/constants/taxonomy';
import type { Category } from '@/constants/taxonomy';
import { colors, layout, radius, spacing } from '@/theme';

type Props = {
  /** The category being shown alone, or null for all. */
  selected: Category | null;
  onChange: (category: Category | null) => void;
  counts: Partial<Record<Category, number>>;
};

/**
 * The map legend, doubling as a filter: each chip shows a category's pin
 * colour; tapping it shows only that category (tap again for all).
 */
export function CategoryLegend({ selected, onChange, counts }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Map legend and category filter">
      {CATEGORIES.map((category) => {
        const isOn = selected === category;
        const isDimmed = selected !== null && !isOn;
        const meta = CATEGORY_META[category];
        return (
          <Pressable
            key={category}
            onPress={() => onChange(isOn ? null : category)}
            accessibilityRole="button"
            accessibilityState={{ selected: isOn }}
            accessibilityLabel={`${category}, ${counts[category] ?? 0} on the map`}
            accessibilityHint={isOn ? 'Shows every category again' : 'Shows only this category'}
            style={({ pressed }) => [
              styles.chip,
              isOn && styles.chipOn,
              isDimmed && styles.chipDimmed,
              pressed && styles.pressed,
            ]}>
            <View style={[styles.swatch, { backgroundColor: colors[meta.color] }]} />
            <AppText variant="label" color={isOn ? 'onPrimary' : 'ink'} numberOfLines={1}>
              {meta.shortLabel}
            </AppText>
            <AppText variant="caption" color={isOn ? 'onPrimaryMuted' : 'muted'}>
              {counts[category] ?? 0}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: layout.chipHeight,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: layout.hairline,
    borderColor: colors.outline,
  },
  chipOn: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipDimmed: {
    opacity: 0.6,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  swatch: {
    width: spacing.md,
    height: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
