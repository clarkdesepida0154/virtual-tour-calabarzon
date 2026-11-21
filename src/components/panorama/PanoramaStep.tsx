/**
 * The tour's "360° View" step (Run 8), between Gallery and Chapter I —
 * only where the tour offers it (src/lib/panorama.ts: curated as having a
 * panorama, or added in the app and shown optimistically; never offline).
 *
 * Full-bleed Street View (Maps Embed API in a WebView / iframe) on the dark
 * exhibit wall: a pulsing shimmer while it loads, a "Drag to look around"
 * hint, Google's imagery credit, and "Open in Google Maps" as the way out.
 * For a destination that was not curated the app cannot see inside
 * Google's frame, so after a few seconds it adds a gentle "no imagery here?"
 * note with the same way out (shown at once if the frame fails to load).
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { Skeleton } from '@/components/Skeleton';
import { useI18n } from '@/context/I18nContext';
import { useToast } from '@/context/ToastContext';
import { openStreetView, tapFeedback } from '@/lib/device';
import { MAPS_EMBED_KEY } from '@/lib/embedKey';
import { PANORAMA_DETECT_MS, isCurated, panoramaEmbedUrl } from '@/lib/panorama';
import { layout, motion, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import type { Destination } from '@/types/database';

import { PanoramaFrame } from './PanoramaFrame';

/** The shimmer stays a moment after the framing page loads, while Google draws the first tiles. */
const SETTLE_MS = 1200;

export function PanoramaStep({
  destination,
  topInset,
  bottomInset,
}: {
  destination: Destination;
  topInset: number;
  bottomInset: number;
}) {
  const styles = useStyles();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [loaded, setLoaded] = useState(false);
  const [settled, setSettled] = useState(false);
  const [failed, setFailed] = useState(false);
  const [patienceOver, setPatienceOver] = useState(false);
  const curated = isCurated(destination);
  const url = panoramaEmbedUrl(destination, MAPS_EMBED_KEY);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => setSettled(true), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [loaded]);

  useEffect(() => {
    if (curated) return;
    const timer = setTimeout(() => setPatienceOver(true), PANORAMA_DETECT_MS);
    return () => clearTimeout(timer);
  }, [curated]);

  const openInMaps = async () => {
    tapFeedback();
    if (!(await openStreetView(destination))) showToast(t('streetView.failed'));
  };

  const showNoImagery = failed || !url || (!curated && patienceOver);

  return (
    <View style={[styles.flex, { paddingTop: topInset + layout.topBarHeight }]}>
      <View style={styles.header}>
        <AppText variant="overline" color="secondary">
          {t('panorama.overline')}
        </AppText>
        <AppText variant="chapterTitle" color="onPhoto" accessibilityRole="header" numberOfLines={2}>
          {t('panorama.title')}
        </AppText>
      </View>

      <View style={styles.frame} accessible={false}>
        {url && !failed ? (
          <PanoramaFrame
            url={url}
            title={t('panorama.viewA11y', { name: destination.name })}
            onLoaded={() => setLoaded(true)}
            onFailed={() => setFailed(true)}
          />
        ) : null}
        {!settled && !failed && url ? (
          <Animated.View exiting={FadeOut.duration(motion.step)} style={styles.shimmer} pointerEvents="none" accessibilityLabel={t('panorama.loadingA11y')}>
            <Skeleton height="100%" style={styles.shimmerBlock} />
            <View style={styles.shimmerCenter}>
              <AppIcon name="rotate-3d-variant" size="xl" color="onExhibitSoft" />
              <AppText variant="caption" color="onExhibitSoft">
                {t('panorama.loadingA11y')}
              </AppText>
            </View>
          </Animated.View>
        ) : null}
        {settled && !showNoImagery ? (
          <Animated.View entering={FadeIn.duration(motion.step)} style={styles.hint} pointerEvents="none">
            <AppIcon name="gesture-swipe-horizontal" size="sm" color="onPhoto" />
            <AppText variant="label" color="onPhoto">
              {t('panorama.hint')}
            </AppText>
          </Animated.View>
        ) : null}
      </View>

      <View style={[styles.footer, { paddingBottom: bottomInset + layout.actionBarHeight + spacing.lg }]}>
        {showNoImagery ? (
          <Animated.View entering={FadeIn.duration(motion.step)} style={styles.noImagery} accessibilityLiveRegion="polite">
            <AppText variant="subtitle" color="onPhoto">
              {t('panorama.noImageryTitle')}
            </AppText>
            <AppText variant="caption" color="onExhibitSoft">
              {t('panorama.noImageryMessage')}
            </AppText>
          </Animated.View>
        ) : null}
        <View style={styles.footerRow}>
          <AppText variant="caption" color="onExhibitSoft" style={styles.flex}>
            {t('panorama.credit')}
          </AppText>
          <Pressable
            onPress={() => void openInMaps()}
            accessibilityRole="button"
            accessibilityLabel={t('streetView.actionA11y', { name: destination.name })}
            accessibilityHint={t('streetView.hint')}
            style={({ pressed }) => [styles.mapsLink, pressed && styles.pressed]}>
            <AppIcon name="open-in-new" size="sm" color="secondary" />
            <AppText variant="label" color="secondary">
              {t('panorama.openInMaps')}
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.xs,
  },
  frame: {
    flex: 1,
    backgroundColor: colors.exhibit,
    borderTopWidth: layout.hairline,
    borderBottomWidth: layout.hairline,
    borderColor: colors.onExhibitFaint,
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.exhibit,
  },
  shimmerBlock: {
    borderRadius: 0,
    backgroundColor: colors.glass,
  },
  shimmerCenter: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  hint: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.glass,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  mapsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.sm,
  },
  noImagery: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glass,
    borderWidth: layout.hairline,
    borderColor: colors.onExhibitFaint,
  },
}));
