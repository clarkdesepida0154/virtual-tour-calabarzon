import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { colors, elevation, layout, radius, spacing } from '@/theme';
import type { ColorToken } from '@/theme';

/**
 * - `idle`     before an answer is picked
 * - `correct`  the right answer, once any answer is picked (forest green)
 * - `wrong`    the learner's pick, when it was wrong (terracotta)
 * - `dimmed`   the other options after answering
 */
export type OptionState = 'idle' | 'correct' | 'wrong' | 'dimmed';

type Props = {
  letter: string;
  text: string;
  state: OptionState;
  /** True for the option the learner picked. */
  picked: boolean;
  disabled: boolean;
  onPress: () => void;
};

const LOOK: Record<
  OptionState,
  { background: ColorToken; border: ColorToken; badge: ColorToken; badgeText: ColorToken; text: ColorToken }
> = {
  idle: { background: 'surface', border: 'outline', badge: 'secondarySoft', badgeText: 'secondaryDark', text: 'ink' },
  correct: { background: 'successSoft', border: 'success', badge: 'success', badgeText: 'onPrimary', text: 'ink' },
  wrong: { background: 'primarySoft', border: 'primary', badge: 'primary', badgeText: 'onPrimary', text: 'ink' },
  dimmed: { background: 'surface', border: 'outline', badge: 'surfaceMuted', badgeText: 'muted', text: 'muted' },
};

const ICONS: Partial<Record<OptionState, IconName>> = {
  correct: 'check-circle',
  wrong: 'close-circle',
};

/** One answer on a quiz card. Locks and recolours itself once an answer is picked. */
export function QuizOptionCard({ letter, text, state, picked, disabled, onPress }: Props) {
  const look = LOOK[state];
  const icon = ICONS[state];
  const status =
    state === 'correct' ? (picked ? 'Your answer, correct.' : 'Correct answer.') : state === 'wrong' ? 'Your answer, incorrect.' : '';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: picked }}
      accessibilityLabel={`Option ${letter}: ${text}. ${status}`}
      android_ripple={disabled ? undefined : { color: colors.pressed }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors[look.background], borderColor: colors[look.border] },
        state === 'idle' && styles.raised,
        (state === 'correct' || state === 'wrong') && styles.emphasis,
        pressed && !disabled && styles.pressed,
      ]}>
      <View style={[styles.badge, { backgroundColor: colors[look.badge] }]}>
        <AppText variant="subtitle" color={look.badgeText}>
          {letter}
        </AppText>
      </View>
      <AppText variant="bodyStrong" color={look.text} style={styles.text}>
        {text}
      </AppText>
      {icon ? <AppIcon name={icon} size="md" color={state === 'correct' ? 'success' : 'primary'} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: layout.touchTarget + spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: layout.hairline,
  },
  raised: {
    ...elevation.card,
  },
  emphasis: {
    borderWidth: 2,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  badge: {
    width: layout.optionBadge,
    height: layout.optionBadge,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
});
