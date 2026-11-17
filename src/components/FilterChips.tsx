import { useEffect, useRef } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { colors, layout, radius, spacing } from '@/theme';

type FilterChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: IconName;
  onLayout?: (event: LayoutChangeEvent) => void;
};

/** A selectable pill. Filled terracotta when on, outlined when off. */
export function FilterChip({ label, selected, onPress, icon, onLayout }: FilterChipProps) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      hitSlop={spacing.xs}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} filter`}
      android_ripple={{ color: colors.pressed, borderless: false }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipIdle,
        pressed && styles.chipPressed,
      ]}>
      {selected ? (
        <AppIcon name="check" size="xs" color="onPrimary" />
      ) : icon ? (
        <AppIcon name={icon} size="xs" color="secondaryDark" />
      ) : null}
      <AppText variant="label" color={selected ? 'onPrimary' : 'ink'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export type FilterOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

type FilterChipRowProps<T extends string> = {
  /** Short group name shown before the chips, e.g. "Category". */
  title: string;
  options: readonly FilterOption<T>[];
  selected: T | null;
  /** Called with the tapped value; tapping the selected chip clears it. */
  onToggle: (value: T) => void;
};

/** One horizontally scrolling group of single-select filter chips. */
export function FilterChipRow<T extends string>({
  title,
  options,
  selected,
  onToggle,
}: FilterChipRowProps<T>) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const chipOffsets = useRef(new Map<string, number>());

  // Bring the active chip into view — it may be off-screen when the filter
  // was chosen on the Home screen — and return to the start when cleared.
  useEffect(() => {
    const timer = setTimeout(() => {
      const offset = selected ? chipOffsets.current.get(selected) : 0;
      if (offset !== undefined) {
        scrollRef.current?.scrollTo({ x: Math.max(0, offset - spacing.huge), animated: true });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [selected]);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}
      accessibilityLabel={`${title} filters`}>
      <View style={styles.title}>
        <AppText variant="overline" color="muted">
          {title}
        </AppText>
      </View>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          icon={option.icon}
          selected={selected === option.value}
          onPress={() => onToggle(option.value)}
          onLayout={(event) => chipOffsets.current.set(option.value, event.nativeEvent.layout.x)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  title: {
    minWidth: spacing.huge + spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: layout.chipHeight,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: layout.hairline,
    overflow: 'hidden',
  },
  chipIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.outlineStrong,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipPressed: {
    opacity: layout.pressedOpacity,
  },
});
