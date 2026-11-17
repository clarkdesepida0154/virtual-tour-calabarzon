import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { colors, layout, maxFontScale, radius, spacing, typography } from '@/theme';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
  icon?: IconName;
};

type Props<T extends string> = {
  label: string;
  /** Heading of the list of choices, e.g. "Choose a province". */
  title: string;
  options: readonly SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  required?: boolean;
  disabled?: boolean;
};

/**
 * Dropdown. Looks like the other outlined inputs; tapping it opens the list
 * of choices in a dialog, which is easier to hit on a phone than a small
 * anchored menu and never gets covered by the keyboard.
 */
export function SelectField<T extends string>({
  label,
  title,
  options,
  value,
  onChange,
  error,
  required = false,
  disabled = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const selected = options.find((option) => option.value === value);

  const openList = () => {
    Keyboard.dismiss();
    setOpen(true);
  };

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
  };

  return (
    <View>
      <Pressable
        onPress={openList}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected ? selected.label : 'not selected'}`}
        accessibilityHint="Opens a list of choices">
        <View pointerEvents="none">
          <TextInput
            mode="outlined"
            label={required ? `${label} *` : label}
            value={selected?.label ?? ''}
            editable={false}
            error={Boolean(error)}
            disabled={disabled}
            maxFontSizeMultiplier={maxFontScale}
            outlineColor={colors.outlineStrong}
            activeOutlineColor={colors.primary}
            textColor={colors.ink}
            outlineStyle={styles.outline}
            contentStyle={styles.content}
            style={styles.input}
          />
          {/* A plain icon, not TextInput.Icon: that one is a button, and a
              button inside this pressable is invalid on web. */}
          <View style={styles.chevron}>
            <AppIcon name="chevron-down" size="md" color="inkSoft" />
          </View>
        </View>
      </Pressable>
      {error ? (
        <HelperText type="error" visible padding="none" style={styles.helper}>
          {error}
        </HelperText>
      ) : null}

      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)} style={styles.dialog}>
          <Dialog.Title style={styles.title}>{title}</Dialog.Title>
          <Dialog.ScrollArea
            style={[styles.scrollArea, { maxHeight: height * layout.dialogMaxHeightRatio }]}>
            <ScrollView>
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => choose(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={option.label}
                    android_ripple={{ color: colors.pressed }}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}>
                    {option.icon ? (
                      <View style={styles.optionIcon}>
                        <AppIcon name={option.icon} size="md" color="secondaryDark" />
                      </View>
                    ) : null}
                    <View style={styles.optionText}>
                      <AppText variant="bodyStrong">{option.label}</AppText>
                      {option.description ? (
                        <AppText variant="caption" color="inkSoft">
                          {option.description}
                        </AppText>
                      ) : null}
                    </View>
                    {isSelected ? <AppIcon name="check" size="md" color="primary" /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button
              onPress={() => setOpen(false)}
              textColor={colors.inkSoft}
              labelStyle={styles.buttonLabel}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surface,
    paddingRight: spacing.xxl,
  },
  chevron: {
    position: 'absolute',
    right: spacing.md,
    // Paper draws the outline slightly below the top to make room for the label.
    top: layout.outlinedInputLabelInset,
    bottom: 0,
    justifyContent: 'center',
  },
  content: {
    ...typography.input,
  },
  outline: {
    borderRadius: radius.md,
  },
  helper: {
    ...typography.caption,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
  },
  title: {
    ...typography.sectionTitle,
    color: colors.ink,
  },
  scrollArea: {
    paddingHorizontal: spacing.none,
    borderColor: colors.outline,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.touchTarget + spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  optionSelected: {
    backgroundColor: colors.primarySoft,
  },
  optionPressed: {
    backgroundColor: colors.pressed,
  },
  optionIcon: {
    width: layout.iconBadge,
    height: layout.iconBadge,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  buttonLabel: {
    ...typography.button,
  },
});
