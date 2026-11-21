import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { useI18n } from '@/context/I18nContext';
import { useNarration } from '@/hooks/useNarration';
import { layout, motion, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';

/**
 * "Listen" for a tour chapter: reads the chapter aloud, and turns into
 * "Stop" (with a gentle pulse) while it speaks. Hidden when narration is
 * switched off in Settings or the device has no English voice.
 */
export function NarrationButton({ text }: { text: string }) {
  const styles = useStyles();
  const { t } = useI18n();
  const narration = useNarration(text);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (narration.isNarrating) {
      pulse.value = withRepeat(withTiming(1, { duration: motion.narrationPulse }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: motion.fast });
    }
  }, [narration.isNarrating, pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.45,
    transform: [{ scale: 1 + pulse.value * 0.12 }],
  }));

  if (!narration.isAvailable) return null;
  const on = narration.isNarrating;

  return (
    <Pressable
      onPress={narration.toggle}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={t(on ? 'narration.stopA11y' : 'narration.listenA11y')}
      hitSlop={spacing.xs}
      style={({ pressed }) => [styles.button, on && styles.buttonOn, pressed && styles.pressed]}>
      <View style={styles.iconWrap}>
        {on ? <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" /> : null}
        <AppIcon name={on ? 'stop-circle-outline' : 'volume-high'} size="md" color={on ? 'onPrimary' : 'primary'} />
      </View>
      <AppText variant="label" color={on ? 'onPrimary' : 'primary'}>
        {t(on ? 'narration.stop' : 'narration.listen')}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  button: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: layout.hairline,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  buttonOn: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  iconWrap: {
    width: layout.narrationIcon,
    height: layout.narrationIcon,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radius.pill,
    borderWidth: layout.narrationRingWidth,
    borderColor: colors.onPrimary,
  },
}));
