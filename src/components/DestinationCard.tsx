import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppIcon } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { CoverImage } from '@/components/CoverImage';
import { FavoriteButton } from '@/components/FavoriteButton';
import { CategoryTag } from '@/components/Tag';
import { CATEGORY_META } from '@/constants/taxonomy';
import { formatPlace } from '@/lib/format';
import { layout, radius, spacing } from '@/theme';
import { makeStyles, useAppTheme } from '@/theme/ThemeProvider';
import type { DestinationSummary } from '@/types/database';
import { useI18n } from '@/context/I18nContext';

type Props = {
  destination: DestinationSummary;
  onPress: (destination: DestinationSummary) => void;
};

type CardProps = Props & {
  /** "12.4 km away" — shown only when the user's location is known. */
  distance?: string | null;
};

/**
 * Explore list card: photo with a favorite heart, category tag, serif name,
 * where it is, and (with Near me) how far away.
 */
export function DestinationCard({ destination, onPress, distance }: CardProps) {
  const styles = useStyles();
  const { t, categoryLabel } = useI18n();
  const category = categoryLabel(destination.category);
  const place = formatPlace(destination);

  return (
    <Pressable
      onPress={() => onPress(destination)}
      accessibilityRole="button"
      accessibilityLabel={
        distance
          ? t('explore.cardDistanceA11y', { name: destination.name, category, place, distance })
          : t('explore.cardA11y', { name: destination.name, category, place })
      }
      accessibilityHint={t('common.opensDetails')}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.clip}>
        <View>
          <CoverImage
            uri={destination.cover_image_url}
            label={t('common.photoOf', { name: destination.name })}
            style={styles.image}
          />
          <View style={styles.tag}>
            <CategoryTag category={destination.category} tone="overlay" />
          </View>
          <FavoriteButton
            destinationId={destination.id}
            name={destination.name}
            size="sm"
            style={styles.heart}
          />
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
          {distance ? (
            <View style={styles.place}>
              <AppIcon name="navigation-variant-outline" size="sm" color="secondaryDark" />
              <AppText variant="label" color="secondaryDark" numberOfLines={1} style={styles.placeText}>
                {distance}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/** Home carousel card: a tall photo with the name set over a dark fade. */
export function FeaturedCard({ destination, onPress }: Props) {
  const styles = useStyles();
  const { colors } = useAppTheme();
  const { t, categoryLabel } = useI18n();
  const place = formatPlace(destination);

  return (
    <Pressable
      onPress={() => onPress(destination)}
      accessibilityRole="button"
      accessibilityLabel={t('home.featured.cardA11y', { name: destination.name, place })}
      accessibilityHint={t('common.opensDetails')}
      style={({ pressed }) => [styles.featured, pressed && styles.pressed]}>
      <View style={styles.featuredClip}>
        <CoverImage
          uri={destination.cover_image_url}
          label={t('common.photoOf', { name: destination.name })}
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
              {categoryLabel(destination.category, 'short')}
            </AppText>
          </View>
          <AppText variant="cardTitle" color="onPhoto" numberOfLines={3}>
            {destination.name}
          </AppText>
          <AppText variant="label" color="onPhotoMuted" numberOfLines={1}>
            {place}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles(({ colors, elevation }) => ({
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
  heart: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    ...elevation.card,
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
}));
