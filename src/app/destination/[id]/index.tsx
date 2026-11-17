import { LinearGradient } from 'expo-linear-gradient';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppIcon } from '@/components/AppIcon';
import type { IconName } from '@/components/AppIcon';
import { AppText } from '@/components/AppText';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CoverImage } from '@/components/CoverImage';
import { DetailsBodySkeleton } from '@/components/Skeleton';
import { EmptyState, ErrorState } from '@/components/StateViews';
import { CategoryTag, ProvinceTag } from '@/components/Tag';
import { useDataSync } from '@/context/DataSyncContext';
import { useToast } from '@/context/ToastContext';
import { useDestination } from '@/hooks/useDestinations';
import { toAppError } from '@/lib/errors';
import { formatCoordinates } from '@/lib/format';
import { destinationImagesRepository, destinationsRepository } from '@/repositories';
import { colors, elevation, iconSize, layout, radius, spacing } from '@/theme';
import type { Destination } from '@/types/database';

/** Distance over which the top bar fades in as the cover scrolls away. */
const HEADER_FADE_DISTANCE = spacing.huge;

export default function DestinationDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const router = useRouter();
  const isFocused = useIsFocused();
  const { notifyChanged } = useDataSync();
  const { showToast } = useToast();
  const query = useDestination(id);

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // After a delete we keep showing the last copy while the screen slides away,
  // instead of flashing a "not found" message.
  const [deletedCopy, setDeletedCopy] = useState<Destination | null>(null);

  // Collapsing header: the top bar fades from "over the photo" to "solid".
  const [scrollY] = useState(() => new Animated.Value(0));
  const [isCollapsed, setIsCollapsed] = useState(false);

  const destination = deletedCopy ?? query.data;
  const coverHeight = Math.max(layout.detailCoverMinHeight, windowHeight * layout.detailCoverRatio);
  const topBarHeight = insets.top + layout.topBarHeight;
  const collapseAt = coverHeight - topBarHeight - radius.xl;

  const headerOpacity = scrollY.interpolate({
    inputRange: [collapseAt - HEADER_FADE_DISTANCE, collapseAt],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handleScroll = Animated.event<NativeScrollEvent>(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
        const next = event.nativeEvent.contentOffset.y >= collapseAt - HEADER_FADE_DISTANCE / 2;
        setIsCollapsed((current) => (current === next ? current : next));
      },
    },
  );

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/explore');
  };

  const handleDelete = async () => {
    if (!destination || isDeleting) return;
    setIsDeleting(true);
    try {
      await destinationsRepository.remove(destination.id);
      // Best-effort: also remove its uploaded photo from storage.
      void destinationImagesRepository.removeByPublicUrl(destination.cover_image_url);
      setDeletedCopy(destination);
      setConfirmVisible(false);
      notifyChanged();
      showToast(`“${destination.name}” was deleted.`);
      leave();
    } catch (cause) {
      setIsDeleting(false);
      setConfirmVisible(false);
      showToast(toAppError(cause, 'We couldn’t delete the destination.').message);
    }
  };

  // --- Error and "not found" states ----------------------------------------
  if (!destination && query.status === 'error' && query.error) {
    return (
      <View style={styles.screen}>
        <BackBar onBack={leave} topInset={insets.top} />
        <ErrorState error={query.error} onRetry={query.retry} style={styles.centered} />
      </View>
    );
  }

  if (!destination && query.status === 'success') {
    return (
      <View style={styles.screen}>
        <BackBar onBack={leave} topInset={insets.top} />
        <EmptyState
          icon="map-marker-off-outline"
          title="Destination not found"
          message="This place is no longer in the collection. It may have been deleted."
          actionLabel="Back to Explore"
          actionIcon="compass-outline"
          onAction={() => router.replace('/explore')}
          style={styles.centered}
        />
      </View>
    );
  }

  const coordinates = destination ? formatCoordinates(destination) : null;
  const actionBarSpace = layout.actionBarHeight + insets.bottom;

  return (
    <View style={styles.screen}>
      {isFocused ? <StatusBar style={isCollapsed ? 'dark' : 'light'} /> : null}

      <Animated.ScrollView
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: actionBarSpace + spacing.xl }}>
        {/* Full-width cover photo */}
        <View style={{ height: coverHeight }}>
          <CoverImage
            uri={destination?.cover_image_url}
            label={destination ? `Photo of ${destination.name}` : 'Loading photo'}
            fallbackIconSize="xxl"
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={[colors.photoShadeSoft, colors.photoShadeNone]}
            style={[styles.coverFade, { height: insets.top + layout.coverFadeHeight }]}
            pointerEvents="none"
          />
        </View>

        {/* Content sheet, overlapping the photo */}
        <View style={styles.sheet}>
          {destination ? (
            <>
              <View style={styles.tags}>
                <CategoryTag category={destination.category} />
                <ProvinceTag province={destination.province} />
              </View>

              <AppText variant="detailTitle" accessibilityRole="header">
                {destination.name}
              </AppText>
              <View style={styles.rule} />

              <View style={styles.facts}>
                <View style={styles.fact}>
                  <AppIcon name="map-marker-outline" size="md" color="primary" />
                  <AppText
                    variant="bodyStrong"
                    style={styles.flex}
                    accessibilityLabel={`Address: ${destination.address}`}>
                    {destination.address}
                  </AppText>
                </View>
                {coordinates ? (
                  <View style={styles.fact}>
                    <AppIcon name="crosshairs-gps" size="md" color="muted" />
                    <AppText
                      variant="label"
                      color="inkSoft"
                      style={styles.flex}
                      accessibilityLabel={`Coordinates: ${coordinates}`}>
                      {coordinates}
                    </AppText>
                  </View>
                ) : null}
              </View>

              <AppText variant="bodyLarge" color="ink">
                {destination.description}
              </AppText>

              {destination.history ? (
                <StorySection
                  icon="book-open-page-variant-outline"
                  title="History"
                  body={destination.history}
                />
              ) : null}
              {destination.cultural_significance ? (
                <StorySection
                  icon="drama-masks"
                  title="Cultural Significance"
                  body={destination.cultural_significance}
                />
              ) : null}
            </>
          ) : (
            <DetailsBodySkeleton />
          )}
        </View>
      </Animated.ScrollView>

      {/* Top bar: back button, plus the name once the photo has scrolled away */}
      <View style={[styles.topBar, { height: topBarHeight, paddingTop: insets.top }]} pointerEvents="box-none">
        <Animated.View style={[styles.topBarFill, { opacity: headerOpacity }]} pointerEvents="none" />
        <IconButton
          icon="arrow-left"
          mode="contained"
          size={iconSize.md}
          containerColor={colors.surface}
          iconColor={colors.ink}
          onPress={leave}
          accessibilityLabel="Go back"
          style={styles.roundButton}
        />
        <Animated.View style={[styles.topBarTitle, { opacity: headerOpacity }]} pointerEvents="none">
          <AppText variant="cardTitleSmall" numberOfLines={1}>
            {destination?.name ?? ''}
          </AppText>
        </Animated.View>
      </View>

      {/* Edit / Delete */}
      {destination ? (
        <View style={[styles.actionBar, { paddingBottom: insets.bottom + spacing.md }]}>
          <AppButton
            label="Edit"
            icon="pencil-outline"
            onPress={() =>
              router.push({ pathname: '/destination/[id]/edit', params: { id: destination.id } })
            }
            disabled={isDeleting}
            style={styles.flex}
            accessibilityHint="Opens the edit form"
          />
          <AppButton
            label="Delete"
            icon="trash-can-outline"
            variant="danger"
            onPress={() => setConfirmVisible(true)}
            disabled={isDeleting}
            style={styles.flex}
            accessibilityHint="Asks for confirmation first"
          />
        </View>
      ) : null}

      <ConfirmDialog
        visible={confirmVisible}
        title="Delete this destination?"
        message={
          destination
            ? `“${destination.name}” will be removed from the collection for everyone. This can’t be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        busy={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmVisible(false)}
      />
    </View>
  );
}

/** Minimal header for the error / not-found states. */
function BackBar({ onBack, topInset }: { onBack: () => void; topInset: number }) {
  return (
    <View style={[styles.backBar, { paddingTop: topInset }]}>
      <IconButton
        icon="arrow-left"
        size={iconSize.md}
        iconColor={colors.ink}
        onPress={onBack}
        accessibilityLabel="Go back"
      />
    </View>
  );
}

type StorySectionProps = {
  icon: IconName;
  title: string;
  body: string;
};

/** A titled card for the longer "virtual tour" texts. */
function StorySection({ icon, title, body }: StorySectionProps) {
  return (
    <View style={styles.story}>
      <View style={styles.storyHeader}>
        <View style={styles.storyIcon}>
          <AppIcon name={icon} size="sm" color="secondaryDark" />
        </View>
        <AppText variant="sectionTitle" accessibilityRole="header" style={styles.flex}>
          {title}
        </AppText>
      </View>
      <AppText variant="bodyLarge" color="inkSoft">
        {body}
      </AppText>
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
  centered: {
    marginTop: spacing.xxxl,
  },
  coverFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    marginTop: -radius.xl,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    gap: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: colors.background,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rule: {
    width: layout.ornamentWidth,
    height: layout.ornamentHeight,
    borderRadius: radius.pill,
    backgroundColor: colors.secondary,
  },
  facts: {
    gap: spacing.sm,
  },
  fact: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  story: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...elevation.card,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  storyIcon: {
    width: spacing.xxl + spacing.xs,
    height: spacing.xxl + spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.secondarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
  },
  topBarFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: colors.background,
    borderBottomWidth: layout.hairline,
    borderBottomColor: colors.outline,
  },
  topBarTitle: {
    flex: 1,
    paddingRight: spacing.lg,
  },
  roundButton: {
    ...elevation.card,
  },
  backBar: {
    paddingHorizontal: spacing.sm,
  },
  actionBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: colors.surface,
    borderTopWidth: layout.hairline,
    borderTopColor: colors.outline,
    ...elevation.bar,
  },
});
