import { Pressable, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { layout, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';

export type Choice<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

type Props<T extends string> = {
  /** Read out for the whole group, e.g. "Appearance". */
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * A row of mutually exclusive options (Light / Dark / System, English /
 * Filipino). Exposed to screen readers as a radio group; each option is at
 * least 48 dp tall.
 */
export function SegmentedChoice<T extends string>({ label, choices, value, onChange }: Props<T>) {
  const styles = useStyles();
  return (
    <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {choices.map((choice) => {
        const selected = choice.value === value;
        return (
          <Pressable
            key={choice.value}
            onPress={() => onChange(choice.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected, selected }}
            accessibilityLabel={choice.label}
            style={({ pressed }) => [
              styles.option,
              choice.icon && styles.optionStacked,
              selected && styles.optionSelected,
              pressed && styles.pressed,
            ]}>
            {choice.icon ? (
              <AppIcon name={choice.icon} size="sm" color={selected ? 'onPrimary' : 'inkSoft'} />
            ) : null}
            <AppText variant="label" color={selected ? 'onPrimary' : 'ink'} numberOfLines={1} align="center">
              {choice.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  group: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
  },
  option: {
    flex: 1,
    minHeight: layout.touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
  },
  // Icon above the label: three options keep their full words even with large text.
  optionStacked: {
    flexDirection: 'column',
    gap: 0,
    paddingVertical: spacing.xs,
    borderRadius: radius.lg,
  },
  optionSelected: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
}));
