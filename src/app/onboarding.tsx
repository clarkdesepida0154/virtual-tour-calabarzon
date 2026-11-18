import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import type { ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { REGION_LABEL } from '@/constants/taxonomy';
import { useIdentity } from '@/context/IdentityContext';
import { colors, elevation, layout, radius, spacing } from '@/theme';

type Slide = {
  numeral: string;
  icon: IconName;
  overline: string;
  title: string;
  body: string;
};

const SLIDES: readonly Slide[] = [
  {
    numeral: 'I',
    icon: 'bank-outline',
    overline: 'Virtual tours',
    title: 'Step inside the region',
    body: 'Walk through 26 shrines, churches, falls and heritage towns of CALABARZON as a guided exhibit — photographs, history and cultural significance, one chapter at a time.',
  },
  {
    numeral: 'II',
    icon: 'school-outline',
    overline: 'Learn & quiz',
    title: 'Read, then test yourself',
    body: 'Every destination ends with a five-question quiz drawn from what you have just read. Retake it as often as you like — your best score is kept.',
  },
  {
    numeral: 'III',
    icon: 'map-marker-path',
    overline: 'Your journey',
    title: 'Track where you have been',
    body: 'Mark places as visited, save favorites and watch each province fill up. When you are ready, get directions and see it in person.',
  },
];

/**
 * First-launch carousel, shown once before Welcome. Swipe or tap Next;
 * "Skip" ends it at any point. Finishing (or skipping) is remembered, and the
 * root stack then moves on to Welcome by itself.
 */
export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { finishOnboarding } = useIdentity();
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
      <StatusBar style="dark" />

      <View style={styles.topBar}>
        <AppText variant="overline" color="secondaryDark" style={styles.flex}>
          {REGION_LABEL}
        </AppText>
        {!isLast ? (
          <Pressable
            onPress={finish}
            hitSlop={spacing.md}
            accessibilityRole="button"
            accessibilityLabel="Skip the introduction"
            style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
            <AppText variant="label" color="primary">
              Skip
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
        accessibilityLabel="Introduction">
        {SLIDES.map((slide, slideIndex) => (
          <SlideView key={slide.numeral} slide={slide} width={width} hidden={slideIndex !== index} />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View
          style={styles.dots}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Slide ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((slide, dotIndex) => (
            <View key={slide.numeral} style={[styles.dot, dotIndex === index && styles.dotActive]} />
          ))}
        </View>
        <AppButton
          label={isLast ? 'Get started' : 'Next'}
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
          {slide.overline}
        </AppText>
        <AppText variant="hero" align="center" accessibilityRole="header">
          {slide.title}
        </AppText>
        <View style={styles.rule} />
        <AppText variant="bodyLarge" color="inkSoft" align="center">
          {slide.body}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
});
