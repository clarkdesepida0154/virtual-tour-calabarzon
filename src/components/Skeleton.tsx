import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import type { DimensionValue, StyleProp, ViewStyle } from 'react-native';

import { colors, elevation, layout, motion, radius, spacing } from '@/theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  style?: StyleProp<ViewStyle>;
};

/** A softly pulsing placeholder block shown while content loads. */
export function Skeleton({ width = '100%', height = spacing.lg, style }: SkeletonProps) {
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
  return (
    <View style={styles.card} accessible accessibilityLabel="Loading destination">
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
  return (
    <View style={styles.details} accessible accessibilityLabel="Loading destination">
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

const styles = StyleSheet.create({
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
});
