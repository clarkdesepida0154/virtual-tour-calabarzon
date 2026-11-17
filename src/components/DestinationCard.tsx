import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { CoverImage } from '@/components/CoverImage';
import { CategoryTag } from '@/components/Tag';
import { CATEGORY_META } from '@/constants/taxonomy';
import { formatPlace } from '@/lib/format';
import { colors, elevation, layout, radius, spacing } from '@/theme';
import type { DestinationSummary } from '@/types/database';

type Props = {
  destination: DestinationSummary;
  onPress: (destination: DestinationSummary) => void;
};

/** Explore list card: photo, category tag, serif name, and where it is. */
export function DestinationCard({ destination, onPress }: Props) {
  const place = formatPlace(destination);

  return (
    <Pressable
      onPress={() => onPress(destination)}
      accessibilityRole="button"
      accessibilityLabel={`${destination.name}, ${destination.category}, ${place}`}
      accessibilityHint="Opens the destination details"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.clip}>
        <View>
          <CoverImage
            uri={destination.cover_image_url}
            label={`Photo of ${destination.name}`}
            style={styles.image}
          />
          <View style={styles.tag}>
            <CategoryTag category={destination.category} tone="overlay" />
          </View>
        </View>
        <View style={styles.body}>
          <AppText variant="cardTitle" numberOfLines={3}>
            {destination.name}
          </AppText>
          <View style={styles.place}>
            <AppIcon name="map-marker-outline" size="sm" color="primary" />
            <AppText variant="label" color="inkSoft" numberOfLines={1} style={styles.placeText}>
              {place}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** Home carousel card: a tall photo with the name set over a dark fade. */
export function FeaturedCard({ destination, onPress }: Props) {
  const place = formatPlace(destination);

  return (
    <Pressable
      onPress={() => onPress(destination)}
      accessibilityRole="button"
      accessibilityLabel={`Featured: ${destination.name}, ${place}`}
      accessibilityHint="Opens the destination details"
      style={({ pressed }) => [styles.featured, pressed && styles.pressed]}>
      <View style={styles.featuredClip}>
        <CoverImage
          uri={destination.cover_image_url}
          label={`Photo of ${destination.name}`}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={[colors.photoShadeNone, colors.photoShadeSoft, colors.photoShadeStrong]}
          locations={[0.3, 0.6, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.featuredText}>
          <View style={styles.featuredCategory}>
            <AppIcon name={CATEGORY_META[destination.category].icon} size="xs" color="secondary" />
            <AppText variant="overline" color="secondary" numberOfLines={1}>
              {CATEGORY_META[destination.category].shortLabel}
            </AppText>
          </View>
          <AppText variant="cardTitle" color="onPrimary" numberOfLines={3}>
            {destination.name}
          </AppText>
          <AppText variant="label" color="onPrimaryMuted" numberOfLines={1}>
            {place}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    ...elevation.card,
  },
  clip: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  pressed: {
    opacity: layout.pressedOpacity,
  },
  image: {
    height: layout.listCardImageHeight,
  },
  tag: {
    position: 'absolute',
    left: spacing.md,
    bottom: spacing.md,
  },
  body: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  placeText: {
    flex: 1,
  },
  featured: {
    width: layout.featuredCardWidth,
    height: layout.featuredCardHeight,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceMuted,
    ...elevation.card,
  },
  featuredClip: {
    flex: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  featuredText: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  featuredCategory: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
});
