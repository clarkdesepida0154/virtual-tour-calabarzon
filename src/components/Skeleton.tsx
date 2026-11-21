import { useEffect, useState } from 'react';
import { Animated, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

import { layout, motion, radius, spacing } from '@/theme';
import { makeStyles } from '@/theme/ThemeProvider';
import { useI18n } from '@/context/I18nContext';

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

/** A softly pulsing placeholder block shown while content loads. */
export function Skeleton({ width = '100%', height = spacing.lg, style }: SkeletonProps) {
  const styles = useStyles();
  const [opacity] = useState(() => new Animated.Value(0.5));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: motion.skeletonPulse,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.5,
          duration: motion.skeletonPulse,
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return <Animated.View style={[styles.block, { width, height, opacity }, style]} />;
}

/** Placeholder for one Explore list card. */
export function DestinationCardSkeleton() {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.card} accessible accessibilityLabel={t('form.loadingA11y')}>
      <Skeleton height={layout.listCardImageHeight} style={styles.cardImage} />
      <View style={styles.cardBody}>
        <Skeleton width="70%" height={spacing.xl} />
        <Skeleton width="45%" height={spacing.lg} />
      </View>
    </View>
  );
}

/** Placeholder for one Home carousel card. */
export function FeaturedCardSkeleton() {
  const styles = useStyles();
  return (
    <Skeleton
      width={layout.featuredCardWidth}
      height={layout.featuredCardHeight}
      style={styles.featured}
    />
  );
}

/** Placeholder for the text block of the Details screen. */
export function DetailsBodySkeleton() {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.details} accessible accessibilityLabel={t('form.loadingA11y')}>
      <Skeleton width="40%" height={spacing.xl} style={styles.pill} />
      <Skeleton width="85%" height={spacing.xxl} />
      <Skeleton width="60%" height={spacing.lg} />
      <View style={styles.paragraph}>
        <Skeleton height={spacing.lg} />
        <Skeleton height={spacing.lg} />
        <Skeleton height={spacing.lg} />
        <Skeleton width="75%" height={spacing.lg} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
  block: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    ...elevation.card,
  },
  cardImage: {
    borderRadius: 0,
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
  },
  cardBody: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  featured: {
    borderRadius: radius.lg,
  },
  details: {
    gap: spacing.lg,
  },
  pill: {
    borderRadius: radius.pill,
  },
  paragraph: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
}));
