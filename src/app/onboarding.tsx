import { useState } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { ThemedStatusBar } from '@/components/ThemedStatusBar';
import { useI18n } from '@/context/I18nContext';
import { useIdentity } from '@/context/IdentityContext';
import { layout, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';

type Slide = {
  key: 'tours' | 'learn' | 'journey';
  numeral: string;
  icon: IconName;
};

/** The words live in the dictionaries (`onboarding.slides.<key>`). */
const SLIDES: readonly Slide[] = [
  { key: 'tours', numeral: 'I', icon: 'bank-outline' },
  { key: 'learn', numeral: 'II', icon: 'school-outline' },
  { key: 'journey', numeral: 'III', icon: 'map-marker-path' },
];

/**
 * First-launch carousel, shown once before Welcome. Swipe or tap Next;
 * "Skip" ends it at any point. Finishing (or skipping) is remembered, and the
 * root stack then moves on to Welcome by itself.
 */
export default function OnboardingScreen() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { finishOnboarding } = useIdentity();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [scroller, setScroller] = useState<ComponentRef<typeof ScrollView> | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const isLast = index === SLIDES.length - 1;

  const finish = async () => {
    if (isLeaving) return;
    setIsLeaving(true);
    await finishOnboarding();
  };

  const goTo = (next: number) => {
    setIndex(next);
    scroller?.scrollTo({ x: next * width, animated: true });
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(width, 1));
    setIndex(Math.min(SLIDES.length - 1, Math.max(0, page)));
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.lg }]}>
      <ThemedStatusBar />

      <View style={styles.topBar}>
        <AppText variant="overline" color="secondaryDark" style={styles.flex}>
          {t('common.region')}
        </AppText>
        {!isLast ? (
          <Pressable
            onPress={finish}
            hitSlop={spacing.md}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.skipA11y')}
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
            <AppText variant="label" color="primary">
              {t('onboarding.skip')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={setScroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScrollEnd}
        style={styles.flex}
        accessibilityLabel={t('onboarding.carouselA11y')}>
        {SLIDES.map((slide, slideIndex) => (
          <SlideView key={slide.key} slide={slide} width={width} hidden={slideIndex !== index} />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View
          style={styles.dots}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('onboarding.slideOf', { index: index + 1, count: SLIDES.length })}>
          {SLIDES.map((slide, dotIndex) => (
            <View key={slide.numeral} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
        <AppButton
          label={t(isLast ? 'onboarding.getStarted' : 'onboarding.next')}
          icon={isLast ? 'check' : 'arrow-right'}
          onPress={isLast ? finish : () => goTo(index + 1)}
          loading={isLeaving}
          style={styles.button}
        />
      </View>
    </View>
  );
}

function SlideView({ slide, width, hidden }: { slide: Slide; width: number; hidden: boolean }) {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View
      style={[styles.slide, { width }]}
      // Only the visible slide is read out by screen readers.
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      accessibilityElementsHidden={hidden}>
      <View style={styles.plate}>
        <View style={styles.plateRing} pointerEvents="none" />
        <AppText variant="tagline" color="secondary">
          {slide.numeral}
        </AppText>
        <AppIcon name={slide.icon} size="xxl" color="secondary" />
      </View>

      <View style={styles.copy}>
        <AppText variant="overline" color="secondaryDark" align="center">
          {t(`onboarding.slides.${slide.key}.overline`)}
        </AppText>
        <AppText variant="hero" align="center" accessibilityRole="header">
          {t(`onboarding.slides.${slide.key}.title`)}
        </AppText>
        <View style={styles.rule} />
        <AppText variant="bodyLarge" color="inkSoft" align="center">
          {t(`onboarding.slides.${slide.key}.body`)}
        </AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.topBarHeight,
    paddingHorizontal: spacing.xl,
  },
  skip: {
    minHeight: layout.touchTarget,
    minWidth: layout.touchTarget,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  plate: {
    width: layout.onboardingPlate,
    height: layout.onboardingPlate,
    borderRadius: radius.xl,
    backgroundColor: colors.exhibit,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    ...elevation.raised,
  },
  plateRing: {
    position: 'absolute',
    top: layout.onboardingRingInset,
    left: layout.onboardingRingInset,
    right: layout.onboardingRingInset,
    bottom: layout.onboardingRingInset,
    borderRadius: radius.lg,
    borderWidth: layout.hairline,
    borderColor: colors.secondary,
  },
  copy: {
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: layout.maxContentWidth,
  },
  rule: {
    width: layout.ornamentWidth,
    height: layout.ornamentHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
  },
  footer: {
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: layout.pageDot,
    height: layout.pageDot,
    borderRadius: radius.pill,
    backgroundColor: colors.outlineStrong,
  },
  dotActive: {
    width: layout.pageDotActive,
    backgroundColor: colors.primary,
  },
  button: {
    alignSelf: 'stretch',
  },
}));
